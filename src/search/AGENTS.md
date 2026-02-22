# src/search AGENTS.md

## OVERVIEW
Advanced search system with bang syntax, filters, commands, and actions. Supports complex queries like `title:docs !frozen !delete`.

---

## STRUCTURE

```
search/
├── index.ts         # Public API exports
├── types.ts         # SearchToken, ParsedQuery, SearchResult
├── parser.ts        # Query tokenization and parsing
├── engine.ts        # Main search execution
├── bangRegistry.ts  # Bang/command definitions
├── utils.ts         # URL normalization, duplicate detection
├── filters/index.ts # Filter functions
└── commands/index.ts # Command execution (delete, save, freeze)
```

---

## QUERY SYNTAX

| Syntax | Example | Description |
|--------|---------|-------------|
| Text | `docs` | Search title and URL |
| Bang | `!frozen` | Filter frozen tabs |
| Negation | `!-frozen` | Exclude frozen tabs |
| Scoped text | `title:api` | Search only title |
| Command | `!delete` | Action on matches |
| Sort | `~title` | Sort by title |

### Available Bangs

| Bang | Description |
|------|-------------|
| `!frozen` / `!discarded` | Frozen/discarded tabs |
| `!audio` / `!audible` | Tabs playing audio |
| `!pin` / `!pinned` | Pinned tabs |
| `!vault` | Items in vault |
| `!grouped` / `!solo` | Grouped / ungrouped tabs |
| `!duplicate` | Duplicate URLs |
| `title:`, `url:` | Scoped text search |

### Commands

| Command | Action |
|---------|--------|
| `!delete` | Close matched tabs |
| `!save` | Save matched tabs to vault |
| `!freeze` | Discard matched tabs |

---

## PUBLIC API

```typescript
import { search, parseQuery, executeCommandsSequentially } from '../search';

// Parse query
const parsed = parseQuery('title:api !frozen !delete');

// Search only
const { results, parsedQuery } = await search('docs !grouped');

// Search and execute commands
const { results, commandResults } = await searchAndExecute('duplicate !delete');
```

---

## KEY TYPES

```typescript
interface ParsedQuery {
  textTerms: string[];
  bangs: BangFilter[];
  commands: CommandType[];
  sort: SortType;
  errors: ParseError[];
}

interface SearchResult {
  tab: Tab;
  matchScore: number;
}
```

---

## TESTING

```bash
npm run test                 # Run all tests
npx vitest -t "parser"       # Run parser tests
npm run bench:search         # Run search benchmarks
```

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Direct `chrome.tabs.query` | `getAllTabs()` from engine |
| Sync search in render | Use async `search()` |
| Ignoring parse errors | Check `parsedQuery.errors` |
