# Fix: Vault Group Tab Buttons Not Working

## Problem

Buttons (Open in Window, Delete) on individual tabs **inside vault groups** do nothing when clicked. The same buttons work correctly for:

- Standalone vault tabs (not in a group)
- Tabs inside live groups

## Root Cause

The buttons **do fire** — the click handlers work and call `restoreFromVault(tab.id)` / `removeFromVault(tab.id)` correctly. The bug is in the **store functions** which only search the **top-level** vault array and never look inside group `tabs` arrays.

### `restoreFromVault` (useVaultSlice.ts line 350-398)

```ts
restoreFromVault: async (id) => {
  const { vault } = get();
  const itemIndex = vault.findIndex((v) => String(v.id) === String(id));
  if (itemIndex === -1) return; // ← Tab is nested in a group, not found, SILENTLY EXITS
  // ...
```

It searches `vault` (the top-level array). A tab inside a vault group has its ID in `vaultGroup.tabs[n].id`, **not** at the top level. `findIndex` returns `-1`, the function returns early, and nothing happens.

### `removeFromVault` (useVaultSlice.ts line 572-577)

```ts
removeFromVault: async (id) => {
  const { vault } = get();
  const newVault = vault.filter((v) => v && String(v.id) !== String(id));
  // ← Only filters top-level items. Nested tab IDs never match. No items removed.
  // ...
```

Same problem — filters only top-level items. The nested tab's ID doesn't match any top-level item, so `newVault` is identical to `vault`.

### Why the live panel works

The live panel's tab close/click handlers use `tabService.closeTab(numericId)` and `tabService.focusTab()`, which operate on Chrome's flat tab list via `chrome.tabs` API. Chrome doesn't care about grouping — a tab ID is a tab ID. There's no nested lookup issue.

### Why standalone vault tabs work

Standalone vault tabs are **top-level** items in the `vault` array, so `findIndex` and `filter` find them immediately.

## Solution

### `restoreFromVault` — search nested tabs

When the ID isn't found at the top level, search inside vault groups' `tabs` arrays. When found, restore just that single tab (not the whole group).

```ts
restoreFromVault: async (id) => {
  const { vault, appearanceSettings } = get();
  const idStr = String(id);

  // First: try top-level
  const itemIndex = vault.findIndex((v) => String(v.id) === idStr);

  if (itemIndex !== -1) {
    // Existing logic for top-level items (groups and standalone tabs)
    // ... (unchanged)
  } else {
    // Search inside vault groups for a nested tab
    let foundTab: VaultTab | null = null;
    for (const item of vault) {
      if ('tabs' in item && Array.isArray(item.tabs)) {
        const match = item.tabs.find((t) => String(t.id) === idStr);
        if (match) {
          foundTab = match;
          break;
        }
      }
    }
    if (!foundTab) return;

    // Calculate insertion index (same logic as existing)
    let insertionIndex = 0;
    // ... (same currentWindowTabs/Groups logic)

    // Create the single tab
    const nt = await tabService.createTab({ url: foundTab.url, active: false, index: insertionIndex });
    if (nt.id) {
      await applyRestorationHints(nt.id, foundTab, appearanceSettings);
    }
    await get().syncLiveTabs();
  }
},
```

### `removeFromVault` — remove nested tabs from their parent group

When the ID isn't found at the top level, search inside groups and remove the tab from its parent group's `tabs` array.

```ts
removeFromVault: async (id) => {
  const { vault, appearanceSettings, persistVault } = get();
  const idStr = String(id);

  // Check if it's a top-level item first
  const isTopLevel = vault.some((v) => String(v.id) === idStr);

  let newVault: VaultItem[];
  if (isTopLevel) {
    // Existing behavior
    newVault = vault.filter((v) => v && String(v.id) !== idStr);
  } else {
    // Remove the tab from inside its parent group
    newVault = vault.map((item) => {
      if ('tabs' in item && Array.isArray(item.tabs)) {
        const filteredTabs = item.tabs.filter((t) => String(t.id) !== idStr);
        if (filteredTabs.length !== item.tabs.length) {
          return { ...item, tabs: filteredTabs };
        }
      }
      return item;
    });
  }

  set({ vault: newVault });
  await persistVault(newVault, appearanceSettings.vaultSyncEnabled);
},
```

## Files to Modify

1. **`src/store/slices/useVaultSlice.ts`** — `restoreFromVault` and `removeFromVault` functions
