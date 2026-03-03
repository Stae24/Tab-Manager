import { CollisionDetection, closestCorners } from '@dnd-kit/core';

export const createCollisionDetection = (pointerPriorityZones: string[]): CollisionDetection => {
  const zoneSet = new Set(pointerPriorityZones);

  return (args) => {
    const { droppableRects, pointerCoordinates } = args;

    if (pointerCoordinates) {
      for (const zoneId of zoneSet) {
        const rect = droppableRects.get(zoneId);
        if (rect) {
          const { x, y } = pointerCoordinates;
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return [{ id: zoneId, data: { value: 0 } }];
          }
        }
      }
    }

    return closestCorners(args);
  };
};
