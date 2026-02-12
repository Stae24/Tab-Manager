# src/services AGENTS.md

## OVERVIEW
Service layer wrapping Chrome Extension APIs. Provides retry logic, error handling, and storage abstraction for the rest of the application.

## SERVICES

### tabService
Core tab/group operations with `withRetry` wrapper for transient errors (user dragging, tab not editable).

**Key Methods:**
- `getLiveTabsAndGroups()`: Syncs browser state → store format
- `createIsland()`: Groups tabs with Opera GX companion tab hack
- `moveIsland()` / `moveTab()`: Relocation with retry
- `duplicateIsland()`: Clone group preserving order

**Retry Logic (`withRetry`):**
- 3 attempts max
- Backoff: 0ms → 100ms → 200ms
- Retryable: "dragging", "not editable", "locked"
- Non-retryable: "invalid ID", "no tab"

### vaultService
Persistent archive storage with compression and chunking.

**Storage Strategy:**
- **Sync Enabled**: LZ-String compressed chunks in `chrome.storage.sync`
- **Sync Disabled**: Direct JSON in `chrome.storage.local`
- **Chunk Size**: `CHROME_SYNC_ITEM_MAX_BYTES` (~8KB)
- **Backup**: Always write to `vault_backup` in local

**Operations:**
- `loadVault()`: Load + decompress + checksum verify
- `saveVault()`: Compress + chunk + verify + cleanup old chunks
- `migrateFromLegacy()`: One-time upgrade from old storage format
- `toggleSyncMode()`: Switch between sync/local storage

### settingsService
User preferences with debounced persistence.

**Keys:** `appearanceSettings`, `dividerPosition`, `showVault`, `settingsPanelWidth`

### quotaService
Monitors `chrome.storage.sync` quota for vault warnings.

**Warning Levels:** `none` → `warning` (80%) → `critical` (95%)`

### storageKeys
Vault chunk key management. Exports `VAULT_META_KEY`, `VAULT_CHUNK_PREFIX`, `LEGACY_VAULT_KEY` and `getVaultChunkKeys()` for listing all vault-related storage keys.

## CONVENTIONS
- **Async Wrappers**: All Chrome API calls go through services
- **Error Logging**: Use `logger.error()` with bracketed labels
- **Fallback**: Always have local storage fallback for sync failures

## ANTI-PATTERNS
- **Direct chrome.storage**: Bypasses compression/chunking logic
- **Skipping verify()**: Can lead to silent data corruption
- **Ignoring quota**: User vault fills sync storage
