# Plan: Implement Vault Cloud Sync

## Requirements
- Sync the Vault data across devices using `chrome.storage.sync`.
- Currently, the Vault is stored in `chrome.storage.local`.
- Handle the 100KB total sync quota and 8KB per-item limit.

## Technical Decisions
- **Sync Integration**: Switch `vault` storage from `local` to `sync` in `useStore.ts`.
- **Quota Handling**: Add a check to prevent syncing if data exceeds 100KB.

## TODOs
- [x] 1. Switch Vault to `chrome.storage.sync`
- [x] 2. Verification of Sync functionality
