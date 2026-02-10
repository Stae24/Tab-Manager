# Bug Fix Plan: Vault Storage Sync Banner Issue

## Problem Summary
The "Vault too large for sync" banner appears continuously on every refresh and whenever vault is saved, regardless of actual sync settings or quota state.

## Root Cause
The VaultPanel component uses `appearanceSettings.vaultSyncEnabled` (user preference) to determine whether to show the local storage warning banner. However, when vault operations fall back to local storage due to quota issues:

1. `effectiveSyncEnabled` state gets set to `false` (actual runtime state)
2. `appearanceSettings.vaultSyncEnabled` remains `true` (user's saved preference)
3. The VaultPanel receives the wrong value, causing incorrect banner display

The condition `!vaultSyncEnabled` at line 986 evaluates incorrectly because it checks the user's preference rather than the actual effective sync state.

## Files to Modify

### 1. `src/components/Dashboard.tsx`

**Changes needed:**

- Line ~1059: Add `effectiveSyncEnabled` to the store subscription alongside `appearanceSettings`
- Line ~1511: Pass `effectiveSyncEnabled` to VaultPanel instead of `appearanceSettings.vaultSyncEnabled`
- Line ~828: Update VaultPanel props type to include `effectiveSyncEnabled?: boolean`
- Line ~986: Update banner condition to use `effectiveSyncEnabled !== undefined ? !effectiveSyncEnabled : !vaultSyncEnabled`

### 2. Optional: `src/store/slices/useVaultSlice.ts`

**Verify:**
- `effectiveSyncEnabled` is properly exported as part of store state type

## Implementation Details

```typescript
// In Dashboard.tsx around line 1059, add:
const effectiveSyncEnabled = useStore(state => state.effectiveSyncEnabled);

// Pass to VaultPanel around line 1511:
vaultSyncEnabled={effectiveSyncEnabled !== undefined ? effectiveSyncEnabled : appearanceSettings.vaultSyncEnabled}

// In VaultPanel props (line ~828), update type:
vaultSyncEnabled: boolean | undefined

// Update banner condition (line ~986):
{(effectiveSyncEnabled !== undefined ? !effectiveSyncEnabled : !vaultSyncEnabled) && 
  (vault || []).length > 0 && showLocalStorageWarning && (
```

## Testing
1. Enable sync in settings
2. Add items to vault (should work normally)
3. Trigger quota exceeded scenario (or mock)
4. Verify banner appears when sync falls back to local
5. Verify banner does NOT appear when sync is user-disabled in settings
6. Verify banner persists across refreshes when appropriate

## Related Code
- `src/store/useStore.ts` lines 64-74 - Where effectiveSyncEnabled is calculated
- `src/services/vaultService.ts` lines 175-189 - Where fallback logic triggers
- `src/store/slices/useVaultSlice.ts` lines 55, 77, 185-186 - effectiveSyncEnabled usage
