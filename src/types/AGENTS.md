# src/types AGENTS.md

## OVERVIEW
Core TypeScript type definitions for the entire application. Single source of truth for data structures.

---

## CORE TYPES

### Tab
```typescript
interface Tab {
  id: UniversalId;      // Namespaced: `live-tab-123`
  title: string;
  url: string;
  favicon: string;
  active: boolean;
  discarded: boolean;   // Frozen state
  windowId: number;
  index: number;
  groupId: number;
  muted?: boolean;
  pinned?: boolean;
  audible?: boolean;
}
```

### Island
```typescript
interface Island {
  id: UniversalId;      // Namespaced: `live-group-456`
  title: string;
  color: string;
  collapsed: boolean;
  tabs: Tab[];
}
```

### VaultItem
```typescript
type VaultItem = (Island | Tab) & {
  savedAt: number;
  originalId: UniversalId;
};
```

---

## UNION TYPES

```typescript
type UniversalId = number | string;  // Handle both numeric and namespaced IDs
type LiveItem = Island | Tab;        // Items in live workspace

type DashboardRow =
  | { type: 'gap'; id: string; index: number }
  | { type: 'item'; id: UniversalId; item: Island | Tab };
```

---

## APPEARANCE TYPES

```typescript
type ThemeMode = 'dark' | 'light' | 'system';
type AnimationIntensity = 'full' | 'subtle' | 'off';
type AudioIndicatorMode = 'off' | 'playing' | 'muted' | 'both';
type BorderRadius = 'none' | 'small' | 'medium' | 'large' | 'full';
type ButtonSize = 'small' | 'medium' | 'large';
type FaviconSource = 'chrome' | 'google' | 'google-hd' | 'duckduckgo' | 'icon-horse';

interface AppearanceSettings {
  theme: ThemeMode;
  uiScale: number;
  tabDensity: 'minified' | 'compact' | 'normal' | 'spacious';
  animationIntensity: AnimationIntensity;
  accentColor: string;
  // ... see index.ts for full definition
}
```

---

## VAULT STORAGE TYPES

```typescript
type VaultStorageErrorType = 
  | 'QUOTA_EXCEEDED' | 'SYNC_FAILED' | 'CORRUPTION' | 'CHUNK_MISMATCH';

type QuotaWarningLevel = 'none' | 'warning' | 'critical';

interface VaultQuotaInfo {
  used: number;
  available: number;
  total: number;
  percentage: number;
  warningLevel: QuotaWarningLevel;
}
```

---

## USAGE

```typescript
import type { Tab, Island, VaultItem, AppearanceSettings } from '../types/index';
```

---

## CONVENTIONS

| Pattern | Example |
|---------|---------|
| `type` for unions | `type ThemeMode = 'dark' \| 'light'` |
| `interface` for objects | `interface Tab { ... }` |
| Namespaced IDs | `live-tab-123`, `live-group-456`, `vault-789` |

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Inline type definitions | Import from `types/index.ts` |
| `any` for tab data | Use `Tab` or `Island` types |
| Numeric ID comparison | `String(a) === String(b)` |
