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

export function tokenize(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  let i = 0;
  const len = query.length;

  while (i < len) {
    if (/\s/.test(query[i])) {
      i++;
      continue;
    }

    if (query[i] === '"') {
      const start = i;
      i++;
      let literal = '';
      while (i < len && query[i] !== '"') {
        literal += query[i];
        i++;
      }
      if (i < len) i++;
      tokens.push({
        type: 'text',
        raw: query.slice(start, i),
        value: literal,
        position: { start, end: i },
      });
      continue;
    }

    if (query[i] === '/' && i + 1 < len && /[a-zA-Z]/.test(query[i + 1])) {
      const start = i;
      i++;
      let commandName = '';
      while (i < len && /[a-zA-Z]/.test(query[i])) {
        commandName += query[i];
        i++;
      }
      tokens.push({
        type: 'command',
        raw: query.slice(start, i),
        value: commandName.toLowerCase(),
        position: { start, end: i },
      });
      continue;
    }

    if (query[i] === '!' && i + 1 < len && /[a-zA-Z]/.test(query[i + 1])) {
      const start = i;
      i++;
      let bangName = '';
      while (i < len && /[a-zA-Z]/.test(query[i])) {
        bangName += query[i];
        i++;
      }
      tokens.push({
        type: 'bang',
        raw: query.slice(start, i),
        value: bangName.toLowerCase(),
        position: { start, end: i },
      });
      continue;
    }

    if (query[i] === '-' && i + 1 < len && query[i + 1] === '!') {
      const start = i;
      i += 2;
      let bangName = '';
      while (i < len && /[a-zA-Z]/.test(query[i])) {
        bangName += query[i];
        i++;
      }
      tokens.push({
        type: 'exclude',
        raw: query.slice(start, i),
        value: bangName.toLowerCase(),
        position: { start, end: i },
      });
      continue;
    }

    if (query[i] === '-' && i + 1 < len && query[i + 1] === '/') {
      i += 2;
      continue;
    }

    const start = i;
    let text = '';
    while (i < len) {
      const ch = query[i];
      if (ch === '"' || ch === '!' || ch === '/' || ch === ',') {
        break;
      }
      if (ch === '-' && i + 1 < len && (query[i + 1] === '!' || query[i + 1] === '/')) {
        break;
      }
      text += ch;
      i++;
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
    } else if (i < len) {
      const ch = query[i];
      if (ch === '!' || ch === '/' || ch === '"') {
        tokens.push({
          type: 'text',
          raw: ch,
          value: ch,
          position: { start: i, end: i + 1 },
        });
        i++;
      }
    }
  }

  return tokens;
}

export function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim();
  const tokens = tokenize(trimmed);
  const textTerms: string[] = [];
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
          if (nextToken.type === 'bang' || nextToken.type === 'exclude' || nextToken.type === 'command') {
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
