# Opera GX Island Manager - Work Plan

## 1. Project Overview
A Chrome Extension specifically optimized for Opera GX to manage tabs and Tab Islands using a dual-panel, drag-and-drop interface.

## 2. Technical Stack
- **Framework:** React + Vite
- **Styling:** Tailwind CSS (Dark/Light Mode)
- **State Management:** Zustand
- **Drag & Drop:** @dnd-kit
- **Persistence:** chrome.storage.sync (Cloud Vault)
- **APIs:** chrome.tabGroups, chrome.tabs, chrome.sidePanel

## 3. Core Features
### A. Interface
- **Dual Panels:** Resizable divider between "Live" (browser state) and "Vault" (saved state).
- **UI Scaling:** Slider to adjust global zoom level (75% to 150%).
- **Opera Sidebar:** Optimized layout for the narrow sidebar panel using `sidebar_action` in manifest and responsive Tailwind layouts.
- **Cross-Platform Compatibility:** Support for `opr.sidebarAction` (Opera) and `chrome.sidePanel` (Chrome).

### B. Tab Management
- **Island Support:** Visual grouping mirroring Opera GX Tab Islands using `chrome.tabGroups`.
- **New Island Drop Zone:** Dedicated area to drag tabs into to create a new group.
- **Action Menu:** Floating menu for:
    - Ungrouping
    - Deleting
    - Saving (Copy to Vault)
    - Freezing (Discarding tab to save RAM using `chrome.tabs.discard`)

### C. The Vault (Cloud Sync)
- **Default Behavior:** Copy tabs/islands on drag.
- **Configurable Behavior:** Option to "Move" (save and close).
- **Restoration:** Open saved items back into the live browser.

### D. Data Export
- **Formats:** JSON, CSV, Markdown, HTML.
- **Scope:** Export either the Live panel or the Vault.

## 4. Implementation Steps
1. **Setup:** Initialize Vite project and Manifest V3.
2. **Background Service:** Create a worker to track tab/group changes and sync with the UI.
3. **UI Layout:** Build the resizable two-panel dashboard and theme engine.
4. **Live Synchronization:** Implement hooks to pull current browser state into the Live panel.
5. **Vault Logic:** Implement `chrome.storage.sync` storage and restoration logic.
6. **Interaction:** Integrate `@dnd-kit` for sorting and the Island Drop Zone.
7. **Sidebars & Export:** Finalize the Opera Sidebar view and the data export module.

## 5. Success Criteria
- [x] User can drag a tab into the "New Island" zone and create a group.
- [ ] Vault data syncs across devices using Chrome Sync.
- [x] UI scale and Theme settings persist.
- [x] Extension functions as both a full page and a sidebar action.
