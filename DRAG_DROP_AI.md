# Drag-and-Drop Move Process - AI Documentation

## Data Structures

```typescript
interface Tab {
  id: string;
  pinned?: boolean;
  containerId?: string;
  index?: number;
}

interface Group {
  id: string;
  tabs: string[]; // Array of tab IDs
}

type Item = Tab | Group;
type Panel = 'islands' | 'vault';
```

## Core Function Pattern

```typescript
// Minimal implementation - no React, no state, pure function
function moveItemOptimistically(
  items: Item[], 
  activeId: string, 
  overId: string
): Item[] {
  if (activeId === overId) return items;
  
  // Find indices
  const activeIdx = items.findIndex(i => i.id === activeId);
  const overIdx = items.findIndex(i => i.id === overId);
  
  if (activeIdx === -1 || overIdx === -1) return items;
  
  // Critical: Save over index BEFORE removal
  const targetIdx = overIdx;
  
  // Remove and insert
  const [item] = items.splice(activeIdx, 1);
  items.splice(targetIdx, 0, item);
  
  return items;
}
```

## Critical Index Shift Fix

```typescript
// WRONG - causes bug when moving to higher indices
const overIdx = items.findIndex(i => i.id === overId); // After removal!

// RIGHT - saves position before removal
const overIdx = items.findIndex(i => i.id === overId); // Before removal
const targetIdx = overIdx;
const [item] = items.splice(activeIdx, 1);
items.splice(targetIdx, 0, item);
```

## Complex Cases

### Hierarchical Structure

```typescript
interface Hierarchical {
  root: Item[];
  groups: Map<string, Item[]>;
}

function findInHierarchical(h: Hierarchical, id: string): {
  container: string;
  index: number;
  item: Item;
} | null {
  // Search root
  const rootIdx = h.root.findIndex(i => i.id === id);
  if (rootIdx !== -1) {
    return { container: 'root', index: rootIdx, item: h.root[rootIdx] };
  }
  
  // Search groups
  for (const [groupId, tabs] of h.groups) {
    const tabIdx = tabs.findIndex(i => i.id === id);
    if (tabIdx !== -1) {
      return { container: groupId, index: tabIdx, item: tabs[tabIdx] };
    }
  }
  
  return null;
}
```

### Cross-Container Move

```typescript
function moveCrossContainer(
  h: Hierarchical,
  activeId: string,
  overId: string
): Hierarchical {
  const active = findInHierarchical(h, activeId);
  const over = findInHierarchical(h, overId);
  
  if (!active || !over) return h;
  if (active.container === over.container) {
    // Same container - use simple logic
    return simpleMove(h, active, over);
  }
  
  // Cross-container logic
  const source = active.container === 'root' ? h.root : h.groups.get(active.container)!;
  const target = over.container === 'root' ? h.root : h.groups.get(over.container)!;
  
  const [item] = source.splice(active.index, 1);
  target.splice(over.index, 0, item);
  
  return h;
}
```

## Edge Cases

```typescript
function safeMove(items: Item[], activeId: string, overId: string): Item[] {
  // Validation
  if (!activeId || !overId || activeId === overId) return items;
  if (!Array.isArray(items) || items.length === 0) return items;
  
  const activeIdx = items.findIndex(i => i?.id === activeId);
  const overIdx = items.findIndex(i => i?.id === overId);
  
  if (activeIdx === -1 || overIdx === -1) return items;
  
  // Bounds checking
  const targetIdx = Math.max(0, Math.min(overIdx, items.length - 1));
  
  const [item] = items.splice(activeIdx, 1);
  items.splice(targetIdx, 0, item);
  
  return items;
}
```

## Performance Characteristics

- **Time Complexity**: O(n) for find operations + O(n) for splice = O(n)
- **Space Complexity**: O(1) for in-place operations, O(n) if cloning
- **Optimizations**: 
  - Use Map for ID to index mapping (O(1) lookup)
  - Batch operations for multiple moves
  - Virtual scrolling for large lists

## Integration Points

```typescript
// With React state
const [items, setItems] = useState<Item[]>();

const moveItem = (activeId: string, overId: string) => {
  setItems(prev => moveItemOptimistically([...prev], activeId, overId));
};

// With Zustand store
const moveItem = (activeId: string, overId: string) => {
  const { items } = get();
  set({ items: moveItemOptimistically([...items], activeId, overId) });
};
```

## Required Dependencies

```typescript
// No external dependencies needed for core logic
// Optional: lodash/cloneDeep for complex structures
// Optional: immer for immutable updates
```

## Test Cases

```typescript
const testCases = [
  { name: 'same index', active: 0, over: 0, expect: 'no change' },
  { name: 'move forward', active: 0, over: 2, expect: 'item at 2' },
  { name: 'move backward', active: 5, over: 2, expect: 'item at 2' },
  { name: 'not found', active: -1, over: 2, expect: 'no change' },
  { name: 'same id', active: 'a', over: 'a', expect: 'no change' },
];
```

## Key Insight Summary

1. Save target index BEFORE source removal
2. Handle hierarchical container logic
3. Validate all inputs and bounds
4. Use immutable updates for React integration
5. Optimize with Map for large datasets