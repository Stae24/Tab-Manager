import {
  ParsedQuery,
  SearchToken,
  BangFilter,
  ParseError,
  BangType,
  CommandType,
  SortType,
} from './types';
import { resolveBang, resolveCommand, resolveSort, BANG_REGISTRY } from './bangRegistry';

const isTextScopeBang = (type: BangType): boolean => {
  return BANG_REGISTRY[type]?.type === 'text-scope';
};

const isValueBang = (type: BangType): boolean => {
  return BANG_REGISTRY[type]?.type === 'value';
};

/**
 * Check if position is at a boundary (start of query, preceded by whitespace, or after operator token)
 * This allows consecutive operators like !audio!frozen but prevents mid-word operators like url!audio
 */
const isAtBoundary = (query: string, i: number, lastWasOperator: boolean): boolean => {
  if (i === 0) return true;
  if (/\s/.test(query[i - 1])) return true;
  // Allow consecutive operators (e.g., !audio!frozen)
  if (lastWasOperator) return true;
  return false;
};

export function tokenize(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  let i = 0;
  const len = query.length;
  let lastTokenWasOperator = false; // Track internally

  while (i < len) {
    if (/\s/.test(query[i])) {
      lastTokenWasOperator = false;
      i++;
      continue;
    }

    // Quoted strings - require boundary
    if (query[i] === '"' && isAtBoundary(query, i, lastTokenWasOperator)) {
      const start = i;
      i++;
      let literal = '';
      while (i < len && query[i] !== '"') {
        literal += query[i];
        i++;
      }
      if (i < len) i++;
      const token = {
        type: 'text' as const,
        raw: query.slice(start, i),
        value: literal,
        position: { start, end: i },
      };
      tokens.push(token);
      lastTokenWasOperator = false;
      continue;
    }

    // Commands - require boundary
    if (query[i] === '/' && isAtBoundary(query, i, lastTokenWasOperator) && i + 1 < len && /[a-zA-Z]/.test(query[i + 1])) {
      const start = i;
      i++;
      let commandName = '';
      while (i < len && /[a-zA-Z]/.test(query[i])) {
        commandName += query[i];
        i++;
      }
      const token = {
        type: 'command' as const,
        raw: query.slice(start, i),
        value: commandName.toLowerCase(),
        position: { start, end: i },
      };
      tokens.push(token);
      lastTokenWasOperator = true;
      continue;
    }

    // Bangs - require boundary
    if (query[i] === '!' && isAtBoundary(query, i, lastTokenWasOperator) && i + 1 < len && /[a-zA-Z]/.test(query[i + 1])) {
      const start = i;
      i++;
      let bangName = '';
      while (i < len && /[a-zA-Z]/.test(query[i])) {
        bangName += query[i];
        i++;
      }
      const token = {
        type: 'bang' as const,
        raw: query.slice(start, i),
        value: bangName.toLowerCase(),
        position: { start, end: i },
      };
      tokens.push(token);
      lastTokenWasOperator = true;
      continue;
    }

    // Excluded bangs: -!bang - require boundary
    if (query[i] === '-' && isAtBoundary(query, i, lastTokenWasOperator) && i + 1 < len && query[i + 1] === '!') {
      const start = i;
      i += 2;
      let bangName = '';
      while (i < len && /[a-zA-Z]/.test(query[i])) {
        bangName += query[i];
        i++;
      }
      const token = {
        type: 'exclude' as const,
        raw: query.slice(start, i),
        value: bangName.toLowerCase(),
        position: { start, end: i },
      };
      tokens.push(token);
      lastTokenWasOperator = true;
      continue;
    }

    // Excluded commands: -/command - require boundary
    if (query[i] === '-' && isAtBoundary(query, i, lastTokenWasOperator) && i + 1 < len && query[i + 1] === '/') {
      i += 2;
      lastTokenWasOperator = false;
      continue;
    }

    // Excluded quoted text: -"phrase" - require boundary
    if (query[i] === '-' && isAtBoundary(query, i, lastTokenWasOperator) && i + 1 < len && query[i + 1] === '"') {
      const start = i;
      i += 2; // Skip -"
      let literal = '';
      while (i < len && query[i] !== '"') {
        literal += query[i];
        i++;
      }
      if (i < len) i++; // Skip closing "
      const token = {
        type: 'exclude-text' as const,
        raw: query.slice(start, i),
        value: literal,
        position: { start, end: i },
      };
      tokens.push(token);
      lastTokenWasOperator = true;
      continue;
    }

    // Excluded unquoted text: -term - require boundary
    if (query[i] === '-' && isAtBoundary(query, i, lastTokenWasOperator) && i + 1 < len && /[a-zA-Z0-9]/.test(query[i + 1])) {
      const start = i;
      i++; // Skip -
      let text = '';
      while (i < len && /[a-zA-Z0-9]/.test(query[i])) {
        text += query[i];
        i++;
      }
      const token = {
        type: 'exclude-text' as const,
        raw: query.slice(start, i),
        value: text.toLowerCase(),
        position: { start, end: i },
      };
      tokens.push(token);
      lastTokenWasOperator = true;
      continue;
    }

    const start = i;
    let text = '';
    while (i < len) {
      const ch = query[i];
      // Check if this could be an operator that needs boundary checking
      if (ch === '"' || ch === '!' || ch === '/' || ch === ',') {
        // If it's at a boundary, stop here and let the main loop handle it
        if (isAtBoundary(query, i, lastTokenWasOperator)) {
          // If we haven't collected any text yet, consume this character as text
          // to avoid infinite loop (e.g., when query is just '/' or '!')
          if (text === '') {
            text += ch;
            i++;
            lastTokenWasOperator = false;
          }
          break;
        }
        // Otherwise, consume it as text
        text += ch;
        i++;
        lastTokenWasOperator = false;
        continue;
      }
      if (ch === '-' && i + 1 < len) {
        const nextCh = query[i + 1];
        const couldBeOperator = nextCh === '!' || nextCh === '/' || nextCh === '"' || /[a-zA-Z0-9]/.test(nextCh);
        if (couldBeOperator && isAtBoundary(query, i, lastTokenWasOperator)) {
          break;
        }
        // Otherwise, consume the dash as text
        text += ch;
        i++;
        lastTokenWasOperator = false;
        continue;
      }
      text += ch;
      i++;
      lastTokenWasOperator = false;
    }
    text = text.trim();
    if (text) {
      const actualStart = query.indexOf(text, start);
      tokens.push({
        type: 'text',
        raw: text,
        value: text,
        position: { start: actualStart, end: actualStart + text.length },
      });
    } else if (i < len && query[i] === ',') {
      i++;
    }
  }

  return tokens;
}

export function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim();
  const tokens = tokenize(trimmed);
  const textTerms: string[] = [];
  const excludedTextTerms: string[] = [];
  const bangs: BangFilter[] = [];
  const commands: CommandType[] = [];
  const errors: ParseError[] = [];
  let sort: SortType = 'index';

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'text') {
      const parts = token.value.split(',').map((p) => p.trim()).filter(Boolean);
      textTerms.push(...parts);
      i++;
      continue;
    }

    if (token.type === 'exclude-text') {
      excludedTextTerms.push(token.value.toLowerCase());
      i++;
      continue;
    }

    if (token.type === 'bang' || token.type === 'exclude') {
      const isNegated = token.type === 'exclude';
      const bangName = token.value;
      const resolvedBang = resolveBang(bangName);

      if (!resolvedBang) {
        textTerms.push(bangName);
        i++;
        continue;
      }

      let bangValue: string | undefined;
      let valueStart = token.position.end;

      if (isTextScopeBang(resolvedBang) || isValueBang(resolvedBang)) {
        const collectedText: string[] = [];
        let j = i + 1;
        let currentEnd = token.position.end;

        while (j < tokens.length) {
          const nextToken = tokens[j];
          if (nextToken.type === 'bang' || nextToken.type === 'exclude' || nextToken.type === 'command' || nextToken.type === 'exclude-text') {
            break;
          }
          if (nextToken.type === 'text') {
            if (nextToken.value.includes(',')) {
              const commaIdx = nextToken.value.indexOf(',');
              if (commaIdx !== -1) {
                const rawValueStart = nextToken.raw.indexOf(nextToken.value);
                const firstPart = nextToken.value.slice(0, commaIdx).trim();
                if (firstPart) {
                  collectedText.push(firstPart);
                  currentEnd = nextToken.position.start + rawValueStart + commaIdx;
                }
                const remainder = nextToken.value.slice(commaIdx + 1).trimStart();
                if (remainder) {
                  const trimmedOffset = nextToken.value.slice(commaIdx + 1).length - remainder.length;
                  const remainderStart = nextToken.position.start + rawValueStart + commaIdx + 1 + trimmedOffset;
                  tokens.splice(j + 1, 0, {
                    type: 'text',
                    raw: remainder,
                    value: remainder,
                    position: { start: remainderStart, end: nextToken.position.end },
                  });
                }
              }
              break;
            } else {
              collectedText.push(nextToken.value);
              currentEnd = nextToken.position.end;
            }
          }
          j++;
        }

        if (collectedText.length > 0) {
          bangValue = collectedText.join(' ');
          i = j;
        } else {
          i++;
        }
        valueStart = token.position.end;
      } else {
        i++;
      }

      bangs.push({
        type: resolvedBang,
        value: bangValue,
        negated: isNegated,
        raw: token.raw + (bangValue ? ' ' + bangValue : ''),
        position: { start: token.position.start, end: bangValue ? (tokens[i - 1]?.position.end ?? token.position.end) : token.position.end },
      });
      continue;
    }

    if (token.type === 'command') {
      const commandName = token.value;
      const resolvedCommand = resolveCommand(commandName);

      if (resolvedCommand) {
        commands.push(resolvedCommand);
      }
      i++;
      continue;
    }

    i++;
  }

  const sortIdx = textTerms.findIndex((t) => t.toLowerCase().startsWith('sort:'));
  if (sortIdx !== -1) {
    const sortTerm = textTerms[sortIdx].toLowerCase();
    if (sortTerm === 'sort:title' || sortTerm === 'sort:alpha') {
      sort = 'title';
    } else if (sortTerm === 'sort:url') {
      sort = 'url';
    }
    textTerms.splice(sortIdx, 1);
  }

  return {
    textTerms,
    excludedTextTerms,
    bangs,
    commands,
    sort,
    errors,
    raw: trimmed,
  };
}

export function hasCommands(parsed: ParsedQuery): boolean {
  return parsed.commands.length > 0;
}

export function hasDestructiveCommands(parsed: ParsedQuery): boolean {
  return parsed.commands.some((cmd) => cmd === 'delete');
}

export function getQueryString(parsed: ParsedQuery): string {
  const parts: string[] = [];

  if (parsed.textTerms.length > 0) {
    parts.push(parsed.textTerms.join(', '));
  }

  if (parsed.excludedTextTerms.length > 0) {
    for (const term of parsed.excludedTextTerms) {
      if (term.includes(' ')) {
        parts.push(`-"${term}"`);
      } else {
        parts.push(`-${term}`);
      }
    }
  }

  for (const bang of parsed.bangs) {
    const prefix = bang.negated ? '-!' : '!';
    const value = bang.value ? ` ${bang.value}` : '';
    parts.push(`${prefix}${bang.type}${value}`);
  }

  for (const cmd of parsed.commands) {
    parts.push(`/${cmd}`);
  }

  return parts.join(' ');
}
