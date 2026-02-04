# Opera GX Island Manager

A tactical Chrome extension for managing tabs with a dual-panel interface featuring the Live Workspace and Neural Vault.

## Overview

Opera GX Island Manager provides advanced tab organization through:

- **Live Workspace**: Active Chrome tabs and tab groups
- **Neural Vault**: Persistent archive for storing tabs long-term
- **Drag-and-Drop**: Intuitive reordering with @dnd-kit
- **Virtualization**: Handles 500+ tabs without performance degradation
- **Undo/Redo**: Command pattern for reversible operations

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Dashboard.tsx                      │
│         (Dual-Panel Tactical Dashboard)             │
├───────────────────────┬─────────────────────────────┤
│   Live Workspace      │      Neural Vault           │
│   (Active Tabs)       │    (Archived Tabs)          │
│                       │                             │
│  ┌───────────────┐   │   ┌─────────────────────┐  │
│  │ Island.tsx    │   │   │ VaultPanel.tsx      │  │
│  │ (Tab Groups)  │   │   │                     │  │
│  └───────────────┘   │   └─────────────────────┘  │
│  ┌───────────────┐   │                             │
│  │ TabCard.tsx   │   │                             │
│  │ (Drag Items)  │   │                             │
│  └───────────────┘   │                             │
└───────────────────────┴─────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                    useStore.ts                       │
│           (Zustand State Management)                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────────────┐ │
│  │Tab Slice  │ │Vault Slice│ │Appearance Slice    │ │
│  └───────────┘ └───────────┘ └───────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                   Services Layer                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │tabService│ │vaultServ.│ │settings  │ │quota  │ │
│  └──────────┘ └──────────┘ └──────────┘ └───────┘ │
└───────────────────────┬─────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                   Chrome API                         │
│  (tabs, tabGroups, storage, runtime)                │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript 5.9** - Type safety
- **Zustand 5** - State management
- **@dnd-kit** - Drag-and-drop
- **@tanstack/react-virtual** - List virtualization
- **Tailwind CSS 4** - Styling
- **Vitest** - Testing
- **Vite 7** - Build tool

## Project Structure

```
Tab Manager/
├── src/
│   ├── components/          # UI Components
│   │   ├── Dashboard.tsx   # Main dual-panel layout
│   │   ├── Island.tsx       # Tab group container
│   │   ├── TabCard.tsx      # Individual tab item
│   │   └── ErrorBoundary.tsx
│   ├── store/              # State Management
│   │   ├── useStore.ts     # Zustand store composition
│   │   ├── slices/         # Store slices
│   │   │   ├── useTabSlice.ts
│   │   │   ├── useVaultSlice.ts
│   │   │   └── useAppearanceSlice.ts
│   │   └── __tests__/      # Store tests
│   ├── services/           # Chrome API Wrappers
│   │   ├── tabService.ts   # chrome.tabs operations
│   │   ├── vaultService.ts # Vault persistence
│   │   └── settingsService.ts
│   ├── utils/              # Utilities
│   │   ├── chromeApi.ts    # Chrome API wrappers
│   │   ├── logger.ts       # Structured logging
│   │   └── constants.ts    # Magic numbers
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript types
│   │   └── index.ts        # Canonical type exports
│   ├── background.ts       # Extension service worker
│   └── __tests__/          # Integration tests
├── AGENTS.md               # Project knowledge base
├── COMPONENT_SUMMARY.md    # Component overview
└── SETTINGS.md             # Settings documentation
```

## Key Features

### Drag-and-Drop
- Optimistic UI updates for instant feedback
- Frame-aligned scheduling for performance
- Cross-panel moves (Live ↔ Vault)
- Auto-expanding drop targets

### State Management
- Selective subscriptions to prevent unnecessary re-renders
- isUpdating semaphore for Chrome API coordination
- Debounced persistence (5000ms for settings)
- Command pattern for undo/redo

### Storage Strategy
- **chrome.storage.sync**: Settings, preferences (roamable)
- **chrome.storage.local**: Vault data, large arrays
- **Chunked storage**: Large vaults split into 6KB chunks
- **LZ-String compression**: Reduce storage footprint

### Error Handling
- Error boundaries at App and Dashboard levels
- Retry logic with exponential backoff
- Graceful fallback for corrupted data
- Quota monitoring and warnings

## Setup

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Run tests
npm test

# Type check
npx tsc --noEmit
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript + Vite production build |
| `npm run test` | Run Vitest suite |
| `npx vitest run` | Run tests without watch mode |

## Development

### Adding New Features

1. **Components**: Add to `src/components/`
2. **State**: Create slice in `src/store/slices/`
3. **Services**: Add Chrome API wrappers in `src/services/`
4. **Types**: Export from `src/types/index.ts`

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npx vitest run src/store/__tests__/raceConditions.test.ts

# Watch mode
npx vitest
```

### Type Safety

- All IDs use `UniversalId` type (`number | string`)
- Use `parseNumericId()` for Chrome API calls
- Type guards for storage data validation

## Known Issues

See [ROADMAP.md](./ROADMAP.md) and [PRIORITY_RANKINGS.md](./PRIORITY_RANKINGS.md) for technical debt and planned improvements.

## License

ISC
