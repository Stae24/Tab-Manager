# Island Manager Settings

A comprehensive list of customizable settings for the Island Manager Chrome extension.

## Table of Contents

1. [Appearance](#appearance)
2. [Tab Behavior](#tab-behavior)
3. [Group Behavior](#group-behavior)
4. [Vault Settings](#vault-settings)
5. [Keyboard Shortcuts](#keyboard-shortcuts)
6. [Privacy & Security](#privacy--security)
7. [Import/Export](#importexport)

---

## Appearance

### UI Scale
- **Setting:** `uiScale`
- **Type:** Slider (0.75 - 1.50, step 0.05)
- **Default:** 1.00 (100%)
- **Description:** Scale the entire UI up or down for better readability.

### Tab Density
- **Setting:** `tabDensity`
- **Type:** Dropdown
- **Options:** `minified`, `compact`, `normal`, `spacious`
- **Default:** `normal`
- **Description:** Controls padding and font size for tabs.
  - `minified`: Zero vertical padding, 8px text
  - `compact`: 1px vertical padding, 9px text
  - `normal`: 2px vertical padding, 12px text
  - `spacious`: 3px vertical padding, 14px text

### Show Favicons
- **Setting:** `showFavicons`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Display website favicons in tabs.

### Show Audio Indicators
- **Setting:** `showAudioIndicators`
- **Type:** Dropdown
- **Options:** `off`, `playing`, `muted`, `both`
- **Default:** `both`
- **Description:** Show audio status icons.
  - `off`: No audio indicators
  - `playing`: Show only when tab is producing audio
  - `muted`: Show only when tab is muted
  - `both`: Show both playing and muted indicators

### Show Frozen Indicators
- **Setting:** `showFrozenIndicators`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Show snowflake icon for discarded/frozen tabs.

### Show Active Indicator
- **Setting:** `showActiveIndicator`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Show accent-colored line on active tabs.

### Animation Intensity
- **Setting:** `animationIntensity`
- **Type:** Dropdown
- **Options:** `full`, `subtle`, `off`
- **Default:** `full`
- **Description:** Control UI animation effects.
  - `full`: All animations enabled
  - `subtle`: Only essential animations
  - `off`: No animations

### Theme
- **Setting:** `theme`
- **Type:** Dropdown
- **Options:** `dark`, `light`, `system`
- **Default:** `dark`
- **Description:** Color theme for the extension.

### Compact Group Headers
- **Setting:** `compactHeaders`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Use smaller padding for group headers.

### Button Size
- **Setting:** `buttonSize`
- **Type:** Dropdown
- **Options:** `small`, `medium`, `large`
- **Default:** `medium`
- **Description:** Size of action buttons on tabs and groups.

---

## Tab Behavior

### Confirm Before Closing
- **Setting:** `confirmClose`
- **Type:** Dropdown
- **Options:** `never`, `multiple`, `always`
- **Default:** `multiple`
- **Description:** When to show confirmation before closing tabs.
  - `never`: Never confirm
  - `multiple`: Confirm only when closing multiple tabs
  - `always`: Always confirm

### Focus After Closing
- **Setting:** `focusAfterClose`
- **Type:** Dropdown
- **Options:** `stay`, `next`, `previous`
- **Default:** `stay`
- **Description:** Which tab to activate after closing one.
  - `stay`: Keep focus on current position
  - `next`: Activate the next tab
  - `previous`: Activate the previous tab

### Double-Click to Pin
- **Setting:** `doubleClickToPin`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Double-click a tab to pin/unpin it.

### Middle-Click to Close
- **Setting:** `middleClickToClose`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Middle-click a tab to close it.

### Drag Creates New Window
- **Setting:** `dragCreatesWindow`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Dragging a tab outside the window creates a new browser window.

### Auto-Refresh Interval
- **Setting:** `autoRefreshInterval`
- **Type:** Dropdown
- **Options:** `off`, `30s`, `1m`, `5m`, `10m`
- **Default:** `off`
- **Description:** Automatically refresh tab list at interval.

### Sort Tabs Alphabetically
- **Setting:** `sortTabsAlphabetically`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Automatically sort tabs within groups alphabetically by title.

### Maximum Tabs Displayed
- **Setting:** `maxTabsDisplayed`
- **Type:** Number (0 = unlimited)
- **Range:** 0 - 500
- **Default:** 0
- **Description:** Maximum number of tabs to display per group. Older tabs are hidden.

---

## Group Behavior

### Default Group Color
- **Setting:** `defaultGroupColor`
- **Type:** Dropdown
- **Options:** `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`
- **Default:** `grey`
- **Description:** Color assigned to new groups by default.

### Collapse Groups on Open
- **Setting:** `collapseOnOpen`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Automatically collapse groups when opening the extension.

### Show Group Tab Count
- **Setting:** `showTabCount`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Show number of tabs in each group header.

### Group Title Position
- **Setting:** `groupTitlePosition`
- **Type:** Dropdown
- **Options:** `left`, `center`, `right`
- **Default:** `left`
- **Description:** Alignment of group titles in headers.

### Close Empty Groups
- **Setting:** `closeEmptyGroups`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Automatically delete groups when they become empty.

### Rename on Creation
- **Setting:** `renameOnCreation`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Start in rename mode when creating a new group.

---

## Vault Settings

### Auto-Save to Vault
- **Setting:** `autoSaveToVault`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Automatically save closed tabs to the vault.

### Maximum Vault Groups
- **Setting:** `maxVaultGroups`
- **Type:** Number (0 = unlimited)
- **Range:** 0 - 100
- **Default:** 0
- **Description:** Maximum number of groups in the vault.

### Maximum Tabs Per Vault Group
- **Setting:** `maxTabsPerVaultGroup`
- **Type:** Number (0 = unlimited)
- **Range:** 0 - 1000
- **Default:** 0
- **Description:** Maximum tabs per group in the vault.

### Vault Auto-Backup
- **Setting:** `vaultAutoBackup`
- **Type:** Dropdown
- **Options:** `off`, `daily`, `weekly`, `monthly`
- **Default:** `off`
- **Description:** Automatically backup vault to local storage.

### Clear Vault on Exit
- **Setting:** `clearVaultOnExit`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Delete all vault contents when Chrome closes.

### Open Vault in New Window
- **Setting:** `vaultOpenInNewWindow`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Open vault tabs in a new window instead of the current one.

### Restore Creates Copy
- **Setting:** `restoreCreatesCopy`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** When restoring from vault, keep the original in the vault.

### Vault Search
- **Setting:** `vaultSearch`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Show search bar in the vault panel.

---

## Keyboard Shortcuts

### Enable Custom Shortcuts
- **Setting:** `enableShortcuts`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Enable custom keyboard shortcuts.

### Shortcut Configuration
| Action | Default Shortcut | Customizable |
|--------|-----------------|--------------|
| Focus search | `Ctrl/Cmd + K` | Yes |
| Create new group | `Ctrl/Cmd + N` | Yes |
| Save all tabs to vault | `Ctrl/Cmd + S` | Yes |
| Toggle vault | `Ctrl/Cmd + \\` | Yes |
| Refresh tabs | `Ctrl/Cmd + R` | Yes |
| Close current tab | `Ctrl/Cmd + W` | Yes |
| Pin current tab | `Ctrl/Cmd + P` | Yes |
| Collapse all groups | `Ctrl/Cmd + Shift + C` | Yes |
| Expand all groups | `Ctrl/Cmd + Shift + E` | Yes |

---

## Privacy & Security

### Block Tab Tracking
- **Setting:** `blockTracking`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Prevent websites from tracking tab activity.

### Clear Data on Uninstall
- **Setting:** `clearDataOnUninstall`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Delete all extension data when uninstalling.

### Incognito Mode
- **Setting:** `incognitoMode`
- **Type:** Dropdown
- **Options:** `block`, `allow`, `vault-only`
- **Default:** `block`
- **Description:** How to handle incognito windows.
  - `block`: Don't load extension in incognito
  - `allow`: Allow in incognito
  - `vault-only`: Only allow vault operations

### Local Storage Only
- **Setting:** `localStorageOnly`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Store all data locally, never sync across devices.

---

## Import/Export

### Export Format
- **Setting:** `exportFormat`
- **Type:** Dropdown
- **Options:** `json`, `csv`, `md`
- **Default:** `json`
- **Description:** Default format for exporting tabs.

### Include Timestamps
- **Setting:** `includeTimestamps`
- **Type:** Toggle (on/off)
- **Default:** `on`
- **Description:** Include creation/modification dates in exports.

### Import Duplicates
- **Setting:** `importDuplicates`
- **Type:** Dropdown
- **Options:** `skip`, `replace`, `merge`
- **Default:** `skip`
- **Description:** How to handle duplicate tabs on import.
  - `skip`: Don't import duplicates
  - `replace`: Replace existing tabs with same URL
  - `merge`: Add as new tabs regardless

### Export Groups Separately
- **Setting:** `exportGroupsSeparately`
- **Type:** Toggle (on/off)
- **Default:** `off`
- **Description:** Export each group as a separate file.

### Auto-Export
- **Setting:** `autoExport`
- **Type:** Dropdown
- **Options:** `off`, `daily`, `weekly`, `on-close`
- **Default:** `off`
- **Description:** Automatically export vault data.

---

## Future Considerations

### Sync Settings
- Chrome Sync for cross-device preferences
- Selective sync (appearance only, exclude vault)

### Advanced Features
- Tab bookmarks integration
- Session saving/loading
- Tab search within groups
- Bulk operations UI
- Tab performance metrics
- Custom CSS themes

### Integrations
- Notion export
- Todoist integration
- Pocket/Read Later services
- Custom webhook notifications

---

## Implementation Priority

**High Priority (v1.1):**
- UI Scale
- Tab Density
- Theme
- Animation Intensity
- Confirm Before Close
- Focus After Close
- Auto-Refresh Interval

**Medium Priority (v1.2):**
- Show Favicons
- Show Audio Indicators
- Double-Click to Pin
- Middle-Click to Close
- Sort Tabs Alphabetically
- Auto-Save to Vault
- Maximum Vault Groups

**Low Priority (v2.0):**
- Keyboard Shortcut Configuration
- Custom CSS
- Advanced Integrations
