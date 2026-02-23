# Phase 1: Critical Slice Tests

**Target Coverage:** 80%+
**Estimated Tests:** ~400
**Priority:** CRITICAL
**Duration:** ~4-6 hours

---

## Overview

Store slices contain the core business logic for tab management and vault operations. Current coverage is critically low:
- `useTabSlice.ts`: 31.14%
- `useVaultSlice.ts`: 27.53%

These slices handle optimistic updates, quota management, and Chrome API orchestration. Bugs here cascade to the entire application.

---

## Files to Create

```
src/store/slices/__tests__/
├── useTabSlice.test.ts
└── useVaultSlice.test.ts
```

---

## Test File: `useTabSlice.test.ts`

### Setup Requirements

```typescript
// Mock dependencies
vi.mock('../../../services/tabService', () => ({
  tabService: {
    getLiveTabsAndGroups: vi.fn(),
    getCurrentWindowTabs: vi.fn(),
    getCurrentWindowGroups: vi.fn(),
    moveTab: vi.fn(),
    moveIsland: vi.fn(),
    updateTabGroup: vi.fn(),
    updateTabGroupCollapse: vi.fn(),
    closeTabs: vi.fn(),
    closeTab: vi.fn(),
    consolidateAndGroupTabs: vi.fn(),
  }
}));

vi.mock('../../../utils/browser', () => ({
  initBrowserCapabilities: vi.fn(),
}));
```

### Test Suites

#### 1. `syncLiveTabs`

**Uncovered Lines:** 68-86

| Test | Scenario | Assertions |
|------|----------|------------|
| returns early when isUpdating is true | Set `isUpdating: true`, call `syncLiveTabs` | `tabService.getLiveTabsAndGroups` not called |
| returns early when hasPendingOperations | Add pending operation, call `syncLiveTabs` | Service not called |
| handles concurrent calls gracefully | Call `syncLiveTabs` twice simultaneously | Only one service call, no race condition |
| sets isRefreshing lock during sync | Call `syncLiveTabs` | `isRefreshing` true during call, false after |
| handles service errors gracefully | Mock service to throw | Error logged, `isRefreshing` reset to false |
| populates islands with normalized data | Mock tabs/groups response | Islands array contains correct Tab/Island types |

#### 2. `renameGroup`

**Uncovered Lines:** 88-107

| Test | Scenario | Assertions |
|------|----------|------------|
| renames vault group (optimistic update) | Call with `vault-` prefixed ID | Vault updated, `persistVault` called |
| renames live group via Chrome API | Call with `live-group-123` | `tabService.updateTabGroup` called with numeric ID |
| handles missing numeric ID | Call with malformed ID | Returns early, no API call |
| persists vault changes when not updating | Rename vault item with `isUpdating: false` | `persistVault` called |
| skips persist when isUpdating is true | Rename vault item with `isUpdating: true` | `persistVault` not called |

#### 3. `toggleLiveGroupCollapse`

**Uncovered Lines:** 109-146

| Test | Scenario | Assertions |
|------|----------|------------|
| returns early for vault items | Call with `vault-` prefix | No state change |
| returns early when numeric ID is null | Call with non-numeric ID | No state change |
| returns early when supportsGroupCollapse is false | Set `supportsGroupCollapse: false` | No API call |
| optimistically updates collapsed state | Toggle a group | State updated before API call |
| reverts on API failure | Mock `updateTabGroupCollapse` to return false | State reverted to original |
| finds correct island by ID | Multiple islands present | Only target island updated |

#### 4. `initBrowserCapabilities`

**Uncovered Lines:** 148-165

| Test | Scenario | Assertions |
|------|----------|------------|
| skips if already initialized | `supportsGroupCollapse` not null | No service call |
| sets supportsGroupCollapse to true | Mock `initBrowserCapabilities` returns true | State updated |
| sets supportsGroupCollapse to false on error | Mock throws error | State set to false |
| logs info messages | On success/failure | Logger called with context |

#### 5. `moveItemOptimistically` (CORE DND ENGINE)

**Uncovered Lines:** 167-325

This is the most complex and critical function. Test extensively:

| Test | Scenario | Assertions |
|------|----------|------------|
| **Cross-panel blocking** | Move live item to vault dropzone | State unchanged |
| **Cross-panel blocking** | Move vault item to live dropzone | State unchanged |
| **Same ID check** | Move item onto itself | State unchanged |
| **Debounce enforcement** | Call twice within 100ms | Only second move processed |
| **Gap targeting** | Move to `live-gap-2` | Item inserted at index 2 |
| **Bottom targeting** | Move to `live-bottom` | Item appended to end |
| **Reorder within root** | Move tab from index 0 to index 3 | Order updated correctly |
| **Move into group** | Move tab into collapsed group | Target container is root (collapsed behavior) |
| **Move into group** | Move tab into expanded group | Target container is group ID, index 0 |
| **Move out of group** | Move tab from group to root | Removed from group tabs, added to root |
| **Group reordering** | Move island from index 1 to index 4 | Islands array reordered |
| **Group cannot nest** | Move island into another group | Target container reset to root |
| **Tab at end of group** | Move to last position in group | Index adjusted correctly |
| **Item not found** | Move non-existent ID | No state change |
| **Index correction** | Source index mismatch | Correct index found and used |

#### 6. `deleteDuplicateTabs`

**Uncovered Lines:** 327-369

| Test | Scenario | Assertions |
|------|----------|------------|
| finds URL duplicates | Two tabs with same normalized URL | Both found |
| normalizes URLs correctly | `https://Example.com/` vs `https://example.com` | Treated as duplicate |
| handles malformed URLs | `chrome://extensions`, `about:blank` | No crash, normalized |
| keeps active tab | Duplicate set with one active tab | Active tab preserved |
| keeps first tab when none active | Duplicate set, no active | First tab preserved |
| closes duplicate IDs | Multiple duplicates found | `closeTabs` called with correct IDs |
| syncs after deletion | Duplicates deleted | `syncLiveTabs` called |
| handles empty result | No duplicates | No API calls |
| logs fatal errors | Service throws | Error logged |

#### 7. `sortGroupsToTop`

**Uncovered Lines:** 371-414

| Test | Scenario | Assertions |
|------|----------|------------|
| returns early when isUpdating | Set `isUpdating: true` | No changes |
| separates pinned/groups/loose | Mixed island types | Correct categorization |
| sorts groups by count when enabled | `sortGroupsByCount: true` | Larger groups first |
| preserves order when sort disabled | `sortGroupsByCount: false` | Original order maintained |
| skips if already sorted | Islands already in correct order | No API calls |
| moves islands via service | Group needs repositioning | `moveIsland` called |
| moves tabs via service | Tab needs repositioning | `moveTab` called |
| handles move failures gracefully | `moveTab` throws | Warning logged, continues |
| syncs after completion | All moves done | `syncLiveTabs` called |
| sets updating lock | During sort operation | `isUpdating` true, then false |

#### 8. `groupSearchResults`

**Uncovered Lines:** 416-426

| Test | Scenario | Assertions |
|------|----------|------------|
| extracts numeric IDs | Pass Tab[] with `live-tab-123` IDs | `[123]` passed to service |
| calls consolidateAndGroupTabs | Valid tab array | Service called with IDs and options |
| sets updating lock | During operation | `isUpdating` managed |
| syncs after grouping | Service completes | `syncLiveTabs` called |
| handles empty array | No tabs provided | Service not called |

#### 9. `groupUngroupedTabs`

**Uncovered Lines:** 428-445

| Test | Scenario | Assertions |
|------|----------|------------|
| filters to ungrouped tabs | Mixed islands/tabs | Only non-group tabs included |
| excludes pinned tabs | Pinned tab present | Excluded from grouping |
| requires at least 2 tabs | Only 1 ungrouped tab | No API call |
| groups 2+ tabs | 2+ ungrouped tabs | `consolidateAndGroupTabs` called |
| sets updating lock | During operation | `isUpdating` managed |
| syncs after grouping | Service completes | `syncLiveTabs` called |

---

## Test File: `useVaultSlice.test.ts`

### Setup Requirements

```typescript
vi.mock('../../../services/vaultService', () => ({
  vaultService: {
    loadVault: vi.fn(),
    saveVault: vi.fn(),
    toggleSyncMode: vi.fn(),
    disableVaultSync: vi.fn(),
  }
}));

vi.mock('../../../services/quotaService', () => ({
  quotaService: {
    getVaultQuota: vi.fn(),
  }
}));

vi.mock('../../../services/tabService', () => ({
  tabService: {
    closeTabs: vi.fn(),
    closeTab: vi.fn(),
    createTab: vi.fn(),
    createIsland: vi.fn(),
    getCurrentWindowTabs: vi.fn(),
    getCurrentWindowGroups: vi.fn(),
  }
}));

vi.mock('../../../services/settingsService', () => ({
  settingsService: {
    saveSettings: vi.fn(),
    loadSettings: vi.fn(),
  }
}));
```

### Test Suites

#### 1. `persistVault`

**Uncovered Lines:** 96-184

| Test | Scenario | Assertions |
|------|----------|------------|
| checks quota at 100% | Quota at 100% | Auto-disables sync, falls back to local |
| calls vaultService.saveVault | Normal save | Service called with correct params |
| reverts on failure | saveVault returns `success: false` | Vault reset to previous state |
| sets compression tier | Result includes `compressionTier` | State updated |
| shows compression warning | Tier is not 'full' | `showCompressionWarning: true` |
| handles fallbackToLocal | Result has `fallbackToLocal: true` | Sync disabled, settings saved |
| updates quota after save | Successful save | `vaultQuota` refreshed |
| sets quotaExceededPending | Error is QUOTA_EXCEEDED | State flag set |

#### 2. `refreshVaultQuota`

**Uncovered Lines:** 186-189

| Test | Scenario | Assertions |
|------|----------|------------|
| fetches and sets quota | Call function | `quotaService.getVaultQuota` called, state updated |

#### 3. `setVaultSyncEnabled`

**Uncovered Lines:** 193-228

| Test | Scenario | Assertions |
|------|----------|------------|
| enables sync successfully | Call with `true`, service succeeds | State updated, settings saved |
| disables sync successfully | Call with `false`, service succeeds | State updated |
| handles fallbackToLocal | Service returns fallback | Sync set to false, quota warning cleared |
| saves settings after toggle | Any successful toggle | `settingsService.saveSettings` called |
| refreshes quota after toggle | Success | Quota fetched |

#### 4. `moveToVault` (CRITICAL PATH)

**Uncovered Lines:** 230-329

| Test | Scenario | Assertions |
|------|----------|------------|
| item not found | Invalid ID | Early return, warning logged |
| quota check blocks move | `checkQuotaBeforeSave` returns not allowed | No state change |
| auto-switches to local on quota | Quota exceeded with sync enabled | Sync disabled, settings saved |
| removes item from islands | Valid move | Item removed from islands array |
| removes from nested group | Item inside a group | Removed from group.tabs |
| generates vault ID | Move item | ID transformed to `vault-{original}-{timestamp}` |
| preserves originalId | Move item | `originalId` set correctly |
| adds to vault array | Valid move | Item appended to vault |
| persists vault | After state update | `persistVault` called |
| closes tabs on success | Move island | `closeTabs` called with all tab IDs |
| closes single tab on success | Move single tab | `closeTab` called |
| reverts islands on failure | persistVault fails | Islands restored to original |
| transforms nested tab IDs | Move island with tabs | All tab IDs transformed |
| logs progress | During move | Info logs at each step |

#### 5. `saveToVault`

**Uncovered Lines:** 331-378

| Test | Scenario | Assertions |
|------|----------|------------|
| quota check blocks save | Not allowed | Early return |
| auto-switches to local | Quota exceeded | Sync disabled |
| transforms item ID | Save item | ID prefixed with `vault-` |
| preserves originalId | Save item | Set correctly |
| adds savedAt timestamp | Save item | Timestamp present |
| persists new vault | After add | `persistVault` called |

#### 6. `restoreFromVault`

**Uncovered Lines:** 380-418

| Test | Scenario | Assertions |
|------|----------|------------|
| item not found | Invalid ID | Early return |
| calculates insertion index with groups | Groups present | Index after last group |
| calculates insertion index no groups | Only loose tabs | Index at end |
| restores island (multiple tabs) | Island item | `createTab` for each, then `createIsland` |
| restores single tab | Tab item | Single `createTab` call |
| uses correct insertion index | Restore operation | Index parameter correct |
| preserves group color/title | Restore island | `createIsland` with original props |

#### 7. `createVaultGroup`

**Uncovered Lines:** 420-435

| Test | Scenario | Assertions |
|------|----------|------------|
| creates empty group | Call function | New group added at start |
| generates unique ID | Create group | ID contains timestamp |
| sets default properties | New group | title='', color='grey', tabs=[] |
| persists vault | After creation | `persistVault` called |

#### 8. `reorderVault`

**Uncovered Lines:** 437-441

| Test | Scenario | Assertions |
|------|----------|------------|
| sets vault state | Call with new order | State updated |
| persists new order | After state update | `persistVault` called |

#### 9. `toggleVaultGroupCollapse`

**Uncovered Lines:** 443-456

| Test | Scenario | Assertions |
|------|----------|------------|
| ignores non-vault IDs | `live-` prefix | No change |
| toggles collapsed state | Valid vault group ID | State flipped |
| persists when not updating | `isUpdating: false` | `persistVault` called |
| skips persist when updating | `isUpdating: true` | `persistVault` not called |

#### 10. `sortVaultGroupsToTop`

**Uncovered Lines:** 458-473

| Test | Scenario | Assertions |
|------|----------|------------|
| categorizes items | Mixed vault | Pinned/groups/loose separated |
| sorts groups by count when enabled | Setting enabled | Larger groups first |
| skips if already sorted | Correct order | No reorder call |
| calls reorderVault | Needs sorting | Called with sorted array |

#### 11. `deleteVaultDuplicates`

**Uncovered Lines:** 475-532

| Test | Scenario | Assertions |
|------|----------|------------|
| finds duplicates in groups | Same URL in multiple group tabs | Detected |
| finds duplicates in loose items | Same URL in loose vault items | Detected |
| normalizes URLs | Case/path differences | Treated as duplicate |
| handles malformed URLs | Invalid URL | Normalized gracefully |
| keeps first occurrence | Multiple duplicates | First kept, rest removed |
| removes duplicate items | Duplicates found | Filtered from vault |
| persists cleaned vault | After removal | `persistVault` called |
| handles no duplicates | No duplicates found | No changes |
| logs deletion count | After removal | Info logged with count |

#### 12. `removeFromVault`

**Uncovered Lines:** 534-539

| Test | Scenario | Assertions |
|------|----------|------------|
| removes item by ID | Valid ID | Item filtered out |
| persists after removal | Removal done | `persistVault` called |

#### 13. Helper: `checkQuotaBeforeSave`

**Uncovered Lines:** 19-52

| Test | Scenario | Assertions |
|------|----------|------------|
| allows when sync disabled | `syncEnabled: false` | Returns allowed=true |
| estimates single item size | Empty vault | Size estimated correctly |
| compresses to check size | Existing vault | LZString compression used |
| returns shouldSwitchToLocal | Exceeds available | Flag set to true |
| applies safety margin | Near limit | Margin subtracted |

---

## Verification Commands

```bash
# Run slice tests
npx vitest run src/store/slices/__tests__

# Coverage for slices only
npx vitest run --coverage src/store/slices

# Target: 80%+ coverage on both files
```

---

## Success Criteria

- [ ] `useTabSlice.ts` coverage >= 80%
- [ ] `useVaultSlice.ts` coverage >= 80%
- [ ] All edge cases in `moveItemOptimistically` tested
- [ ] All quota-related branches tested
- [ ] Error handling paths exercised
- [ ] No `as any` or `@ts-ignore` in tests
