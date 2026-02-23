# Comprehensive Test Plan

## Overview

This document outlines all tests needed for the Tab Manager extension. Tests are organized by module and prioritized based on code complexity and risk.

**Status Legend:**
- ✅ = Exists and passing
- ❌ = Missing (needs to be created)
- ⚠️ = Exists but needs enhancement

---

## 1. Service Tests

### 1.1 tabService.test.ts ❌ (deleted - needs recreation)

**Location:** `src/services/__tests__/tabService.test.ts`

**Priority:** HIGH - Core service used throughout the app

**Mock Requirements:**
```typescript
// Mock chrome.* APIs
vi.stubGlobal('chrome', {
  tabs: { query, get, move, group, ungroup, create, discard, remove, update, duplicate },
  tabGroups: { query, move, update },
  windows: { WINDOW_ID_CURRENT, getCurrent, getLastFocused },
  runtime: { lastError: null },
});
```

**Test Cases:**

| Describe Block | Test | Notes |
|----------------|------|-------|
| `getLiveTabsAndGroups` | returns empty array when no tabs or groups | Basic case |
| `getLiveTabsAndGroups` | returns tabs sorted by index | Verify ordering |
| `getLiveTabsAndGroups` | groups tabs inside islands | Verify group mapping |
| `getLiveTabsAndGroups` | handles mixed grouped and ungrouped tabs | Common scenario |
| `getLiveTabsAndGroups` | handles tabs with no group (-1) | Ungrouped tabs |
| `getLiveTabsAndGroups` | handles pinned tabs correctly | Pinned tabs stay separate |
| `getLiveTabsAndGroups` | maps all tab properties correctly | title, url, favicon, active, discarded, muted, pinned, audible |
| `moveIsland` | moves group to specified index | Basic move |
| `moveIsland` | moves group to different window | Cross-window move |
| `moveIsland` | retries on transient errors (dragging) | Retry logic - 3 attempts |
| `moveIsland` | throws after max retries | Error handling |
| `moveIsland` | logs error on failure | Logging verification |
| `moveTab` | moves tab to specified index | Basic move |
| `moveTab` | moves tab to different window | Cross-window move |
| `moveTab` | retries on transient errors | Retry logic |
| `createIsland` | creates group from multiple tabs | Normal case |
| `createIsland` | creates companion tab for single tab group | Opera GX hack |
| `createIsland` | returns null for no valid tabs | Edge case |
| `createIsland` | handles pinned tabs (excludes from group) | Pinned restriction |
| `createIsland` | sets correct title and color | Property passing |
| `createIsland` | preserves active tab state | UX preservation |
| `ungroupTab` | ungroups single tab | Basic ungroup |
| `ungroupTab` | ungroups multiple tabs | Batch ungroup |
| `ungroupTab` | handles errors gracefully | Error case |
| `updateTabGroup` | returns false for invalid group id (-1) | Guard clause |
| `updateTabGroup` | returns false for zero group id | Guard clause |
| `updateTabGroup` | updates group properties | Title, color, collapsed |
| `updateTabGroup` | returns false on chrome.runtime.lastError | Error handling |
| `updateTabGroup` | retries on editable error | Retry logic |
| `updateTabGroupCollapse` | updates collapsed state | Collapse toggle |
| `discardTab` | discards a single tab | Freeze operation |
| `discardTabs` | discards multiple tabs | Batch freeze |
| `closeTab` | closes a single tab | Basic close |
| `closeTabs` | closes multiple tabs | Batch close |
| `closeTabs` | handles empty array | Edge case |
| `getCurrentWindowTabs` | returns tabs in current window | Wrapper for chrome.tabs.query |
| `getCurrentWindowGroups` | returns groups in current window | Wrapper for chrome.tabGroups.query |
| `createTab` | creates a tab with options | URL, active, index, windowId |
| `pinTab` | pins a tab | Pin operation |
| `unpinTab` | unpins a tab | Unpin operation |
| `muteTab` | mutes a tab | Audio control |
| `unmuteTab` | unmutes a tab | Audio control |
| `duplicateTab` | duplicates a tab | Clone operation |
| `copyTabUrl` | copies tab url to clipboard | Clipboard API |
| `consolidateAndGroupTabs` | groups tabs from different windows | Cross-window grouping |
| `consolidateAndGroupTabs` | filters pinned tabs | Pinned exclusion |
| `consolidateAndGroupTabs` | filters restricted URLs | chrome://, about:, etc. |
| `consolidateAndGroupTabs` | uses random color when specified | Color option |

---

### 1.2 quotaService.test.ts ✅ (exists)

**Location:** `src/services/__tests__/quotaService.test.ts`

**Status:** 8 tests passing - needs enhancement

**Additional Tests Needed:**

| Test | Notes |
|------|-------|
| `cleanupOrphanedChunks` handles partial chunk deletion | Some chunks fail to delete |
| `getVaultQuota` handles sync storage errors | Chrome API failure |
| `getVaultQuota` correctly calculates percentage | Edge cases: 0%, 100%, >100% |
| `getStorageHealth` handles local storage | Sync vs local differentiation |
| `getStorageReport` handles missing vault_meta | Missing metadata case |

---

### 1.3 settingsService.test.ts ✅ (exists)

**Location:** `src/services/__tests__/settingsService.test.ts`

**Status:** 4 tests passing - needs enhancement

**Additional Tests Needed:**

| Test | Notes |
|------|-------|
| `loadSettings` validates appearanceSettings type | Type guard integration |
| `loadSettings` handles malformed settings | Corrupted data |
| `saveSettings` handles sync failure | Chrome API error |
| `watchSettings` correctly passes changes to callback | Change detection |
| `watchSettings` handles area filtering | sync vs local changes |

---

## 2. Component Tests

### 2.1 TabCard.test.tsx ❌ (deleted - needs recreation)

**Location:** `src/components/__tests__/TabCard.test.tsx`

**Priority:** HIGH - Most used component, complex logic

**Mock Requirements:**
```typescript
// Key mocks needed:
vi.mock('@dnd-kit/sortable', () => ({ useSortable: vi.fn() }));
vi.mock('../../store/useStore');
vi.mock('../../contexts/ScrollContainerContext');
vi.mock('../../services/tabService');

// IntersectionObserver mock
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
```

**Test Cases:**

| Describe Block | Test | Notes |
|----------------|------|-------|
| Rendering | renders tab title | Basic render |
| Rendering | renders with empty title | Edge case |
| Rendering | applies correct density class | Settings integration |
| Rendering | applies correct border radius class | Settings integration |
| State Indicators | shows discarded indicator when tab.discarded | Snowflake icon |
| State Indicators | hides discarded indicator when showFrozenIndicators=false | Settings override |
| State Indicators | shows audio indicator when tab.audible | Speaker icon |
| State Indicators | shows muted indicator when tab.muted | VolumeX icon |
| State Indicators | hides audio indicators when showAudioIndicators='off' | Settings override |
| State Indicators | shows active indicator when tab.active | Left border |
| State Indicators | shows loading spinner when isLoading=true | Loader2 icon |
| Favicon | renders favicon with correct source | Settings integration |
| Favicon | defers favicon loading when not in viewport | IntersectionObserver |
| Favicon | immediately loads favicon when isOverlay=true | Skip lazy loading |
| Favicon | hides favicon when showFavicons=false | Settings override |
| Click Handlers | calls onClick when clicked | Basic interaction |
| Click Handlers | does not call onClick when isDragging | Drag prevention |
| Click Handlers | does not call onClick when isOverlay | Overlay mode |
| Action Buttons | calls onClose when close button clicked | X button |
| Action Buttons | calls onSave when save button clicked (non-vault) | Save icon |
| Action Buttons | calls onRestore when restore button clicked (vault) | ExternalLink icon |
| Action Buttons | hides save button when isVault=true | Vault mode |
| Action Buttons | hides restore button when isVault=false | Live mode |
| Styling | applies overlay styles when isOverlay=true | Drag overlay |
| Styling | applies vault styles when isVault=true | Different UI |
| Styling | applies loading styles when isLoading=true | Cyan glow |
| Styling | applies drag opacity from settings | appearanceSettings.dragOpacity |
| Context Menu | shows context menu on right-click | Right-click handler |
| Context Menu | hides context menu when isOverlay=true | Overlay mode |
| Context Menu | contains freeze action | Snowflake option |
| Context Menu | contains ungroup action | LogOut option |
| Context Menu | contains pin/unpin action | Link option |
| Context Menu | contains mute/unmute action | Volume option |
| Context Menu | contains duplicate action | CopyPlus option |
| Context Menu | contains copy URL action | Copy option |
| Context Menu | calls tabService.discardTab on freeze | Service integration |
| Context Menu | calls tabService.ungroupTab on ungroup | Service integration |
| DnD Integration | provides correct sortable id | dnd-kit integration |
| DnD Integration | disables sortable when disabled=true | Drag lock |
| DnD Integration | applies transform styles during drag | Visual feedback |

---

### 2.2 Island.test.tsx ❌ (deleted - needs recreation)

**Location:** `src/components/__tests__/Island.test.tsx`

**Priority:** HIGH - Core component, complex interactions

**Mock Requirements:**
```typescript
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(),
  SortableContext: ({ children }) => children,
  verticalListSortingStrategy: {},
}));
vi.mock('../../store/useStore');
vi.mock('../../utils/chromeApi');
vi.mock('./TabCard', () => ({ TabCard: () => <div data-testid="tabcard" /> }));
vi.mock('./ContextMenu', () => ({ ContextMenu: ({ children }) => <div>{children}</div> }));
```

**Test Cases:**

| Describe Block | Test | Notes |
|----------------|------|-------|
| Rendering | renders island title | Basic render |
| Rendering | shows "Untitled Group" when title is empty | Default title |
| Rendering | renders nested TabCards | Children rendering |
| Rendering | hides tabs when collapsed=true | Collapse state |
| Rendering | shows tabs when collapsed=false | Expanded state |
| Rendering | shows tab count when showTabCount=true | Settings integration |
| Rendering | hides tab count when showTabCount=false | Settings override |
| Rendering | applies correct border color from island.color | Color mapping |
| Rendering | applies compact header styles when compactGroupHeaders=true | Settings integration |
| Rendering | applies correct button size from settings | appearanceSettings.buttonSize |
| Collapse Toggle | calls onToggleCollapse when chevron clicked | Collapse handler |
| Collapse Toggle | does not call onToggleCollapse when isOverlay=true | Overlay mode |
| Collapse Toggle | shows ChevronRight when collapsed | Icon state |
| Collapse Toggle | shows ChevronDown when expanded | Icon state |
| Rename | enters edit mode on double-click | Double-click handler |
| Rename | calls onRename with new title on blur | Blur commit |
| Rename | calls onRename with new title on Enter | Keyboard commit |
| Rename | cancels edit on Escape | Cancel handler |
| Rename | disables DnD when editing | isEditing state |
| Rename | trims whitespace from title | Input sanitization |
| Rename | does not call onRename if title unchanged | No-op case |
| Delete | calls onDelete when delete button clicked | Trash icon |
| Delete | shows correct tooltip for vault vs live | Context awareness |
| Save/Restore | calls onSave when save button clicked (non-vault) | Save action |
| Save/Restore | calls onNonDestructiveSave when ND save clicked | Keep live |
| Save/Restore | calls onRestore when restore clicked (vault) | Restore action |
| Save/Restore | hides save button when isVault=true | Vault mode |
| Save/Restore | hides restore button when isVault=false | Live mode |
| Ungroup | calls ungroupTab when ungroup button clicked | Ungroup all |
| Ungroup | parses tab IDs correctly | ID handling |
| Context Menu | shows context menu on right-click | Right-click handler |
| Context Menu | hides context menu when isOverlay=true | Overlay mode |
| Context Menu | contains rename option | Edit3 icon |
| Context Menu | contains duplicate option | Copy icon |
| Context Menu | contains ungroup all option | LogOut icon |
| Context Menu | contains freeze all option | Snowflake icon |
| Context Menu | contains save to vault option | Save icon |
| Context Menu | hides ungroup/freeze when isVault=true | Vault mode |
| Styling | applies overlay styles when isOverlay=true | Drag overlay |
| Styling | applies drag opacity from settings | appearanceSettings.dragOpacity |
| Styling | applies disabled styles when disabled=true | Interaction lock |
| DnD Integration | provides correct sortable id | dnd-kit integration |
| DnD Integration | includes island data in sortable | Drag data |
| DnD Integration | disables sortable when disabled=true | Drag lock |
| DnD Integration | disables sortable when isEditing=true | Edit lock |

---

### 2.3 DroppableGap.test.tsx ❌ (needs creation)

**Location:** `src/components/__tests__/DroppableGap.test.tsx`

**Priority:** MEDIUM - DnD infrastructure

**Mock Requirements:**
```typescript
vi.mock('@dnd-kit/core', () => ({
  useDndContext: vi.fn(() => ({ active: null })),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}));
vi.mock('../../hooks/useProximityGap', () => ({
  useProximityGap: vi.fn(() => ({ ref: vi.fn(), isOver: false, expanded: false })),
}));
```

**Test Cases:**

| Describe Block | Test | Notes |
|----------------|------|-------|
| Rendering | renders without crashing | Basic render |
| Rendering | has minimal height when not expanded | Default state |
| Rendering | has expanded height when expanded=true | Proximity state |
| Rendering | applies accent background when isOver and expanded | Drop highlight |
| ID Generation | generates correct ID for live panel gap | live-gap-{index} |
| ID Generation | generates correct ID for vault panel gap | vault-gap-{index} |
| useProximityGap | passes correct gapId to hook | ID passing |
| useProximityGap | passes active from DndContext | Drag context |
| useProximityGap | passes isDraggingGroup for live panel | Group drag handling |
| useProximityGap | passes false for isDraggingGroup on vault panel | Vault ignores group flag |

---

### 2.4 LivePanel.test.tsx ✅ (exists - needs enhancement)

**Location:** `src/components/__tests__/LivePanel.test.tsx`

**Status:** 6 tests passing

**Additional Tests Needed:**

| Test | Notes |
|------|-------|
| shows correct tab count in header | Count display |
| shows ungrouped count | Ungrouped tabs indicator |
| enables "Group ungrouped" button when count >= 2 | Button state |
| disables "Group ungrouped" button when count < 2 | Button state |
| calls groupUngroupedTabs when button clicked | Action handler |
| calls sortGroupsToTop when button clicked | Action handler |
| shows expand/collapse all buttons | UI elements |
| calls collapseAll when collapse button clicked | Action handler |
| calls expandAll when expand button clicked | Action handler |
| renders empty state when no tabs | Empty UI |
| renders islands and tabs from islands prop | Content rendering |
| passes correct props to Island components | Props forwarding |
| passes correct props to TabCard components | Props forwarding |
| renders DroppableGaps between islands | Gap insertion |
| does not render gaps before first item | Gap logic |
| does not render gaps for tab items | Gap restriction |
| shows "No tabs found" when search has no results | Empty search |
| renders filtered tabs in search mode | Search results |
| disables drag in search mode | Search restrictions |
| calls groupSearchResults when "Group Results" clicked | Search action |
| disables "Group Results" when < 2 non-pinned tabs | Button state |
| clears search on Escape key | Keyboard handler |
| shows sort dropdown in search mode | Sort UI |
| changes sort option when dropdown item selected | Sort handler |
| virtualizes long lists correctly | Virtualization |
| scrolls to correct position | Scroll behavior |
| shows loading state during delete duplicates | isCleaning state |
| clears search after grouping results | State reset |
| handles isCreatingIsland state | Creation UI |
| shows creatingTabId indicator on correct tab | Loading indicator |
| applies correct width from dividerPosition | Layout |

---

### 2.5 VaultPanel.test.tsx ✅ (exists - needs enhancement)

**Location:** `src/components/__tests__/VaultPanel.test.tsx`

**Status:** 5 tests passing

**Additional Tests Needed:**

| Test | Notes |
|------|-------|
| shows tab count in header | Count display |
| renders vault items correctly | Content rendering |
| passes isVault=true to Island components | Props forwarding |
| passes isVault=true to TabCard components | Props forwarding |
| renders DroppableGaps between vault groups | Gap insertion |
| shows QuotaWarningBanner when vaultQuota provided | Banner rendering |
| hides QuotaWarningBanner when vaultQuota is null | No banner |
| passes warningLevel to QuotaWarningBanner | Banner props |
| calls onManageStorage when banner action clicked | Banner action |
| calls sortVaultGroupsToTop when sort button clicked | Action handler |
| calls onRenameGroup when island renamed | Rename forwarding |
| calls onToggleCollapse when island toggled | Collapse forwarding |
| calls removeFromVault when tab closed | Delete handler |
| calls restoreFromVault when tab restored | Restore handler |
| renders empty state when vault is empty | Empty UI |
| dismisses local storage warning when X clicked | Warning dismiss |
| remembers dismissed warning state | State persistence |
| applies correct width from dividerPosition | Layout |
| highlights panel when dragging live item over it | Drop zone |
| shows red ring when dragging over vault | Drop indicator |
| virtualizes long vault lists | Virtualization |
| handles missing vaultTabCount gracefully | Null safety |

---

## 3. Hook Tests

### 3.1 useProximityGap.test.ts ✅ (exists - needs enhancement)

**Location:** `src/hooks/__tests__/useProximityGap.test.ts`

**Status:** 4 tests passing

**Additional Tests Needed:**

| Test | Notes |
|------|-------|
| sets expanded=true when pointer is within proximity zone | Proximity detection |
| sets expanded=false when pointer is outside zone | Proximity exit |
| calculates expandUp zone correctly (above gap) | Negative distance |
| calculates expandDown zone correctly (below gap) | Positive distance |
| checks horizontal bounds for expansion | X-axis constraint |
| uses correct base rem for calculations | Font size scaling |
| cleans up pointermove listener on unmount | Memory leak prevention |
| cleans up listener when active becomes null | State change cleanup |
| resets expanded to false when active changes | State reset |
| handles rapid active changes without memory leaks | Rapid toggle |
| combines ref with setNodeRef correctly | Ref merging |
| returns isOver from useDroppable | Passthrough |

---

## 4. Integration Tests

### 4.1 Dashboard DnD Integration ❌ (needs creation)

**Location:** `src/components/__tests__/Dashboard.dnd.test.tsx`

**Priority:** HIGH - Critical user flow

**Test Cases:**

| Test | Notes |
|------|-------|
| drag tab within Live panel reorders correctly | Basic reorder |
| drag island within Live panel reorders correctly | Group reorder |
| drag tab from Live to Vault triggers moveToVault | Cross-panel archive |
| drag island from Live to Vault archives all tabs | Group archive |
| drag tab from Vault to Live triggers restoreFromVault | Cross-panel restore |
| drag island from Vault to Live restores all tabs | Group restore |
| drag tab to create zone triggers createIsland | Tactical creation |
| drag disabled during isUpdating lock | Concurrency protection |
| optimistic update applied immediately on drag start | UI responsiveness |
| syncLiveTabs called on drag end | State reconciliation |
| cross-panel drag blocked when showVault=false | Panel visibility |
| drag overlay shows correct preview | Visual feedback |
| keyboard drag works with space/arrow keys | Accessibility |

---

## 5. Test File Checklist

### Services
- [ ] `src/services/__tests__/tabService.test.ts` - RECREATE (was deleted)
- [x] `src/services/__tests__/quotaService.test.ts` - ENHANCE
- [x] `src/services/__tests__/settingsService.test.ts` - ENHANCE

### Components
- [ ] `src/components/__tests__/TabCard.test.tsx` - RECREATE (was deleted)
- [ ] `src/components/__tests__/Island.test.tsx` - RECREATE (was deleted)
- [ ] `src/components/__tests__/DroppableGap.test.tsx` - CREATE
- [x] `src/components/__tests__/LivePanel.test.tsx` - ENHANCE
- [x] `src/components/__tests__/VaultPanel.test.tsx` - ENHANCE
- [ ] `src/components/__tests__/Dashboard.dnd.test.tsx` - CREATE (integration)
- [x] `src/components/__tests__/Favicon.test.tsx` - COMPLETE
- [x] `src/components/__tests__/ErrorBoundary.test.tsx` - COMPLETE

### Hooks
- [x] `src/hooks/__tests__/useProximityGap.test.ts` - ENHANCE
- [x] `src/components/__tests__/useProximityGap.test.ts` - Memory leak tests

### Store
- [x] `src/store/__tests__/useStore.test.ts` - ENHANCE
- [x] `src/store/__tests__/parseNumericId.test.ts` - COMPLETE
- [x] `src/store/__tests__/typeGuards.test.ts` - COMPLETE
- [x] `src/store/__tests__/raceConditions.test.ts` - COMPLETE
- [x] `src/store/__tests__/commands.test.ts` - COMPLETE
- [x] `src/store/__tests__/sync.test.ts` - COMPLETE
- [x] `src/store/__tests__/storageConsistency.test.ts` - COMPLETE

### Utils
- [x] `src/utils/__tests__/chromeApi.test.ts` - ENHANCE (add more functions)
- [x] `src/utils/__tests__/vaultStorage.test.ts` - COMPLETE
- [x] `src/utils/__tests__/errorCases.test.ts` - COMPLETE
- [x] `src/utils/__tests__/logger.test.ts` - COMPLETE

---

## 6. Implementation Priority

### Phase 1: Critical Path (HIGH)
1. `tabService.test.ts` - Core service, heavily used
2. `TabCard.test.tsx` - Most rendered component
3. `Island.test.tsx` - Complex interactions
4. `Dashboard.dnd.test.tsx` - Critical user flow

### Phase 2: Important (MEDIUM)
5. `DroppableGap.test.tsx` - DnD infrastructure
6. Enhance `LivePanel.test.tsx`
7. Enhance `VaultPanel.test.tsx`
8. Enhance `useProximityGap.test.ts`

### Phase 3: Polish (LOW)
9. Enhance `quotaService.test.ts`
10. Enhance `settingsService.test.ts`
11. Enhance `useStore.test.ts`
12. Enhance `chromeApi.test.ts`

---

## 7. Common Mock Patterns

### Chrome API Mock
```typescript
vi.stubGlobal('chrome', {
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    move: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
    create: vi.fn(),
    discard: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    duplicate: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
    move: vi.fn(),
    update: vi.fn(),
    TAB_GROUP_ID_NONE: -1,
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
    getCurrent: vi.fn(),
    getLastFocused: vi.fn(),
  },
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
  },
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      getBytesInUse: vi.fn(),
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
});
```

### DnD Kit Mock
```typescript
vi.mock('@dnd-kit/core', () => ({
  useDndContext: vi.fn(() => ({ active: null })),
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
}));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: '',
    isDragging: false,
  })),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
}));
```

### IntersectionObserver Mock
```typescript
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
```

---

## 8. Notes

- All tests should use `@testing-library/jest-dom/vitest` for extended matchers
- Use `vi.resetModules()` between tests that import modules dynamically
- Mock services at the module level before importing components
- For DnD tests, consider using `@dnd-kit/testing` utilities if available
- Ensure all async operations are properly awaited
- Use `userEvent` over `fireEvent` for user interactions where possible
