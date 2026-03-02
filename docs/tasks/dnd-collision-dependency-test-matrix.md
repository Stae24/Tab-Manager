# DnD Collision Dependency and Validation Matrix

## Purpose
Provide agent-ready coverage matrix for every collision surface, all DnD consumers, and all runtime dependencies that must be validated when implementing collision changes.

## Collision Surfaces Inventory
| Surface ID | Defined In | Primary Use | Must Preserve |
|---|---|---|---|
| `live-panel-dropzone` | `src/components/LivePanel.tsx` | Live panel root target | Live in-panel fallback + vault->live cross-panel target |
| `live-bottom` | `src/components/LivePanel.tsx` | Append-to-end in Live | Stable bottom insertion intent |
| `create-island-dropzone` | `src/components/LivePanel.tsx` | Tab-to-new-island action | Tab-only eligibility |
| `vault-dropzone` | `src/components/VaultPanel.tsx` | Vault panel root target | Live->vault transfer + vault reorder fallback |
| `vault-bottom` | `src/components/VaultPanel.tsx` | Append-to-end in Vault | Stable vault bottom insertion |
| `live-gap-{i}` | `src/components/DroppableGap.tsx` | Fine-grained live insertion | Gap expansion + precise reorder |
| `vault-gap-{i}` | `src/components/DroppableGap.tsx` | Fine-grained vault insertion | Gap expansion + precise reorder |

## Runtime Dependency Graph
1. Pointer and geometry
- `src/contexts/PointerPositionContext.tsx`
- `src/hooks/useProximityGap.ts`
- `src/components/DroppableGap.tsx`

2. Collision resolution
- `src/components/Dashboard.tsx` (`DndContext` collision strategy)
- `src/store/operations/moveItem.ts` (`determineTargetPanel`, `calculateMoveTarget`, `prepareOptimisticMove`)

3. Optimistic move dispatch
- `src/store/slices/useTabSlice.ts` (`moveItemOptimistically` RAF batching)

4. Finalized drag side effects
- `src/components/Dashboard.tsx` (`handleDragEnd`)
- `src/store/commands/MoveTabCommand.ts`, `MoveIslandCommand.ts`
- `src/store/slices/useVaultSlice.ts` (`moveToVault`, `restoreFromVault`, `reorderVault`)

## Risk Matrix (What Can Regress)
| Change Area | Primary Risk | Detection |
|---|---|---|
| Custom collision detector | Wrong target priority, especially near panel edges | DnD integration tests with explicit over-id assertions |
| Scale compensation | Drag pointer/overlay drift when `uiScale != 1` | Targeted scale tests + manual drag at 0.75/1.25/1.5 |
| Create-island gating | Group drag accidentally triggers island creation | Dedicated negative test for group-on-create-zone |
| Gap geometry refresh | Jitter/perf regressions | Hook tests with synthetic scroll/pointer updates |
| Listener cleanup | Memory leaks / duplicate callbacks | mount-unmount tests validating add/remove pairs |
| Service refactor | Undo/redo behavior drift | command execution + undo tests |

## Mandatory Test Cases (Agent Checklist)
1. `tab_reorder_live_gap`
- Drag `live-tab-a` over `live-gap-{i}`.
- Assert optimistic order and final command arguments.

2. `tab_to_vault_dropzone`
- Drag live tab over `vault-dropzone`.
- Assert no optimistic cross-panel reorder, then `moveToVault` on end.

3. `vault_reorder_internal`
- Drag vault item across vault gaps/bottom.
- Assert `reorderVault` receives expected final vault order.

4. `vault_to_live_restore`
- Drag vault item to `live-panel-dropzone` or `live-bottom`.
- Assert `restoreFromVault` called once with active ID.

5. `tab_to_create_island`
- Drag live tab to `create-island-dropzone`.
- Assert creation path executes and cleans pending operation.

6. `group_to_create_island_noop`
- Drag live group to `create-island-dropzone`.
- Assert no `createIsland` attempt and no `chrome.tabs.get(groupId)` call.

7. `scale_modifier_applied`
- Set `uiScale=1.5`; assert drag transform/collision coordinates are compensated.

8. `gap_recalc_after_scroll`
- During active drag, change scroll position; assert proximity expansion tracks new rect position.

9. `id_normalization_guard`
- Use mixed numeric/string IDs that stringify equal.
- Assert self-over comparisons short-circuit correctly.

10. `ref_cleanup_no_leak`
- Mount/unmount bottom dropzone instrumentation repeatedly.
- Assert no accumulated listeners/observers.

## Manual QA Script
1. Set UI scale to `1.0`, `1.25`, `1.5` and drag within live list.
2. Drag live tab into vault root, vault bottom, and vault gap.
3. Drag vault item back to live root and live bottom.
4. Drag live group onto create-island zone (must no-op).
5. Drag live tab onto create-island zone (must create island).
6. While dragging near gaps, scroll list and confirm expansion remains aligned.

## Definition of Done
- All mandatory tests implemented and passing.
- `npm run test:fail-only` outputs no failures.
- `npm run build` succeeds.
- No direct `chrome.*` calls remain in DnD critical paths after service-boundary workstream.
