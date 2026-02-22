# src/services AGENTS.md

## OVERVIEW
Service layer wrapping Chrome Extension APIs. Provides retry logic, error handling, and storage abstraction.

---

## FILES

### tabService.ts
Core tab/group operations with `withRetry` wrapper for transient errors.

**Key Methods:**
| Method | Description |
|--------|-------------|
| `getLiveTabsAndGroups()` | Syncs browser state → store format |
| `createIsland()` | Groups tabs with Opera GX companion tab hack |
| `moveIsland()` / `moveTab()` | Relocation with retry |
| `duplicateIsland()` | Clone group preserving order |

**Retry Logic (`withRetry`):**
- 3 attempts max, exponential backoff (100ms base)
- Retryable: "dragging", "not editable", "Tab cannot be modified"
- Non-retryable: "invalid ID", "no tab"

### vaultService.ts
Persistent archive storage with compression and chunking.

**Storage Strategy:**
- Sync: LZ-String compressed chunks in `chrome.storage.sync`
- Local: Direct JSON in `chrome.storage.local`
- Backup: Always write to `vault_backup` in local

**Key Operations:**
| Method | Description |
|--------|-------------|
| `loadVault()` | Load + decompress + checksum verify |
| `saveVault()` | Compress + chunk + verify + cleanup |
| `recoverVaultSync()` | Self-healing from backup |
| `migrateFromLegacy()` | One-time upgrade from old format |

### settingsService.ts
User preferences with debounced persistence (5s debounce).

**Keys:** `appearanceSettings`, `dividerPosition`, `showVault`, `settingsPanelWidth`

### quotaService.ts
Monitors `chrome.storage.sync` quota for vault warnings.

**Warning Levels:** `none` → `warning` (80%) → `critical` (90%)

### storageKeys.ts
Vault chunk key management constants (`vault_meta`, `vault_chunk_*`).

---

## CONVENTIONS

```typescript
// Good - use service with error handling
import { tabService } from '../services/tabService';
try {
  await tabService.moveTab(tabId, index, windowId);
} catch (error: unknown) {
  logger.error('[Context] Move failed:', error);
}

// Bad - direct Chrome API
await chrome.tabs.move(tabId, { index });
```

---

## ANTI-PATTERNS

| Avoid | Use Instead |
|-------|-------------|
| Direct `chrome.storage` calls | `vaultService` / `settingsService` |
| Skipping `verify()` | Can lead to silent data corruption |
| Ignoring quota warnings | User vault fills sync storage |
| Empty catch blocks | Log with `logger.error()` |
