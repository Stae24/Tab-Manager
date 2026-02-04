
## Refactored Zustand Store into Focused Slices (Task 3.1)
- **Date**: 2026-02-04
- **Context**: The monolithic `src/store/useStore.ts` grew too large (~1167 lines) and became difficult to maintain.
- **Action**: 
    - Split the store into 4 logical slices: `TabSlice`, `VaultSlice`, `UISlice`, and `AppearanceSlice`.
    - Created `src/store/slices/` directory to house the slice implementations.
    - Created `src/store/utils.ts` for shared helper functions and constants (parsing, validation, debounced sync).
    - Created `src/store/types.ts` to define the combined `StoreState` to break circular dependencies between slices.
- **Rationales**:
    - **Separation of Concerns**: Each slice manages a distinct part of the application state.
    - **Maintainability**: Smaller files are easier to read and test.
    - **Type Safety**: Used Zustand's `StateCreator` with the combined `StoreState` to ensure slices have access to the full store state while maintaining strict typing.
    - **Public API Preservation**: Maintained the same exports from `src/store/useStore.ts` to ensure zero breaking changes for the rest of the application.
- **Gotchas**:
    - Circular dependencies between slices and the main store were resolved by moving the `StoreState` definition to a separate `types.ts` file.
    - Dynamic imports were used in some slices to avoid circular dependency issues with utility modules that might reference the store.

## 2026-02-04: Service Layer Implementation (Task 3.2)
- Created `src/services/` directory to house all side-effect logic (Chrome API, Storage).
- Implemented `tabService`, `vaultService`, `settingsService`, and `quotaService`.
- Refactored Zustand store slices to interact exclusively with the Service Layer.
- Preserved retry logic and error handling within services.
- Updated `src/utils/chromeApi.ts` and `src/utils/vaultStorage.ts` to act as re-exporting bridges to maintain compatibility with existing tests and components while ensuring the Store remains clean.
- Maintained 5000ms debounce for settings sync to comply with existing tests and performance constraints.

## Command Pattern for Undo/Redo
- Chose to store Command objects in the store rather than just state snapshots. This allows for more surgical undos and potential for complex operations (like multi-tab moves).
- Decided to capture `dragStartInfo` in the `Dashboard` component to avoid complex state management for transient drag data in the store.
