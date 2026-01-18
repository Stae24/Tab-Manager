import { 
  CollisionDetection,
  Collision,
  closestCorners,
} from '@dnd-kit/core';

/**
 * Tactical Vertical Collision Strategy (V8 - Gap-Filling)
 * 
 * Rules:
 * 1. Prioritize items (Islands/Tabs) over background panels.
 * 2. Fill gaps by using distance-based matching if pointerWithin is empty.
 * 3. Only the 'bottom' zones ('live-panel-bottom', etc) trigger appending.
 */
export const closestEdge: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableContainers } = args;
  
  if (!pointerCoordinates) return [];

  const { x, y } = pointerCoordinates;
  
  // 1. Calculate distances to all items (Islands and Tabs)
  const itemCollisions: (Collision & { distance: number })[] = [];
  const panelCollisions: (Collision & { distance: number })[] = [];

  for (const container of droppableContainers) {
    const rect = container.rect.current;
    if (!rect) continue;

    const data = container.data.current || {};
    const isItem = data.type === 'island' || data.type === 'tab';

    // Horizontal Filter (reduced to 60px buffer to prevent false positives on nearby panels)
    if (x < rect.left - 60 || x > rect.right + 60) continue;

    const centerY = rect.top + rect.height / 2;
    const distanceToCenter = Math.abs(y - centerY);

    if (isItem) {
      const relativeY = (y - rect.top) / rect.height;
      let edge: 'top' | 'bottom' | undefined = undefined;

      if (data.type === 'island') {
        const isCollapsed = data.island?.collapsed;
        // Expanded Header: Top 40% Snaps Before.
        if (!isCollapsed) {
          if (relativeY < 0.4) edge = 'top';
        } else {
          // Collapsed Header: 35/30/35 split
          if (relativeY < 0.35) edge = 'top';
          else if (relativeY > 0.65) edge = 'bottom';
        }
      } else {
        // Tab: 50/50 split
        if (relativeY < 0.5) edge = 'top';
        else edge = 'bottom';
      }

      itemCollisions.push({
        id: container.id,
        distance: distanceToCenter,
        data: { ...data, edge }
      });
    } else {
      // Background panels and bottom zones
      const isBottomZone = String(container.id).includes('bottom');
      const isCreateZone = String(container.id).includes('create');
      const isInside = y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right;
      
      panelCollisions.push({
        id: container.id,
        // Bottom zones and create zone get distance 0 priority when inside
        distance: (isInside && (isBottomZone || isCreateZone)) ? 0 : distanceToCenter, 
        data: { ...data }
      });
    }
  }

  // 2. Combine and sort
  const allCollisions = [...itemCollisions, ...panelCollisions].sort((a, b) => {
    // If one is "inside" (distance 0), it takes high priority
    if (a.distance === 0 && b.distance !== 0) return -1;
    if (b.distance === 0 && a.distance !== 0) return 1;

    // Otherwise, items still take priority over panels if distances are similar
    const aIsItem = (a.data as any)?.type === 'island' || (a.data as any)?.type === 'tab';
    const bIsItem = (b.data as any)?.type === 'island' || (b.data as any)?.type === 'tab';
    
    if (aIsItem && !bIsItem) return -1;
    if (bIsItem && !aIsItem) return 1;
    
    return a.distance - b.distance;
  });

  if (allCollisions.length > 0) {
    return allCollisions.map(({ distance, ...collision }) => collision);
  }

  return [];
};
