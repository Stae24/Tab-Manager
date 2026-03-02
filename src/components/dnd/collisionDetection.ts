import {
  CollisionDetection,
  Collision,
  UniqueIdentifier,
  pointerWithin,
  closestCenter,
  closestCorners,
} from '@dnd-kit/core';
import { isVaultId, isLiveId } from '../../store/utils';

type DropzoneType = 'item' | 'gap' | 'panel-root' | 'panel-bottom' | 'create-zone';

interface TargetBucket {
  type: DropzoneType;
  collisions: Collision[];
}

const DROPZONE_PRIORITIES: Record<DropzoneType, number> = {
  'item': 1,
  'gap': 1,
  'panel-root': 2,
  'panel-bottom': 2,
  'create-zone': 3,
};

const PANEL_DROPZONE_IDS = new Set([
  'live-panel-dropzone',
  'vault-dropzone',
  'live-bottom',
  'vault-bottom',
]);

const CREATE_ZONE_ID = 'create-island-dropzone';

function classifyDropzone(id: UniqueIdentifier): DropzoneType {
  const idStr = String(id);

  if (idStr === CREATE_ZONE_ID) {
    return 'create-zone';
  }

  if (PANEL_DROPZONE_IDS.has(idStr)) {
    if (idStr.endsWith('-bottom')) {
      return 'panel-bottom';
    }
    return 'panel-root';
  }

  if (idStr.includes('-gap-')) {
    return 'gap';
  }

  if (isLiveId(idStr) || isVaultId(idStr)) {
    return 'item';
  }

  return 'item';
}

function isEligibleForCreateZone(activeId: UniqueIdentifier): boolean {
  const idStr = String(activeId);
  return isLiveId(idStr) && !idStr.startsWith('live-group-');
}

function getSourcePanel(activeId: UniqueIdentifier): 'live' | 'vault' | null {
  const idStr = String(activeId);
  if (isLiveId(idStr)) return 'live';
  if (isVaultId(idStr)) return 'vault';
  return null;
}

function getTargetPanel(overId: UniqueIdentifier): 'live' | 'vault' | null {
  const idStr = String(overId);
  if (idStr.startsWith('live-') || idStr === 'live-panel-dropzone' || idStr === 'live-bottom') {
    return 'live';
  }
  if (idStr.startsWith('vault-') || idStr === 'vault-dropzone' || idStr === 'vault-bottom') {
    return 'vault';
  }
  return null;
}

export interface CollisionDetectorOptions {
  prioritizePointer?: boolean;
}

export function createIntentAwareCollisionDetector(
  options: CollisionDetectorOptions = {}
): CollisionDetection {
  const { prioritizePointer = true } = options;

  return (args) => {
    const { active, droppableRects, droppableContainers, pointerCoordinates } = args;

    if (!active) {
      return [];
    }

    const activeId = active.id;
    const sourcePanel = getSourcePanel(activeId);

    let collisions: Collision[] = [];

    if (prioritizePointer && pointerCoordinates) {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        collisions = pointerCollisions;
      }
    }

    if (collisions.length === 0) {
      collisions = closestCorners(args);
    }

    if (collisions.length === 0) {
      return [];
    }

    const buckets: Record<DropzoneType, Collision[]> = {
      'item': [],
      'gap': [],
      'panel-root': [],
      'panel-bottom': [],
      'create-zone': [],
    };

    for (const collision of collisions) {
      const type = classifyDropzone(collision.id);
      buckets[type].push(collision);
    }

    const isSamePanelDrag = (overId: UniqueIdentifier): boolean => {
      if (!sourcePanel) return false;
      const targetPanel = getTargetPanel(overId);
      return targetPanel === sourcePanel;
    };

    const isCrossPanelDrag = (overId: UniqueIdentifier): boolean => {
      if (!sourcePanel) return false;
      const targetPanel = getTargetPanel(overId);
      return targetPanel !== null && targetPanel !== sourcePanel;
    };

    const filterEligibleTargets = (collision: Collision): boolean => {
      const type = classifyDropzone(collision.id);

      if (type === 'create-zone') {
        return isEligibleForCreateZone(activeId);
      }

      if (type === 'panel-root' || type === 'panel-bottom') {
        const overId = collision.id;
        
        if (isSamePanelDrag(overId)) {
          const hasItemOrGapTargets = 
            buckets.item.length > 0 || 
            buckets.gap.length > 0;
          
          if (hasItemOrGapTargets) {
            return false;
          }
        }
      }

      return true;
    };

    let filteredCollisions = collisions.filter(filterEligibleTargets);

    if (filteredCollisions.length === 0) {
      return [];
    }

    filteredCollisions.sort((a, b) => {
      const typeA = classifyDropzone(a.id);
      const typeB = classifyDropzone(b.id);
      const priorityA = DROPZONE_PRIORITIES[typeA];
      const priorityB = DROPZONE_PRIORITIES[typeB];

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return (a.data?.value ?? 0) - (b.data?.value ?? 0);
    });

    const bestCollision = filteredCollisions[0];
    const bestType = classifyDropzone(bestCollision.id);

    if (bestType === 'item' || bestType === 'gap') {
      return filteredCollisions.filter(c => {
        const t = classifyDropzone(c.id);
        return t === 'item' || t === 'gap';
      });
    }

    if (bestType === 'panel-root' || bestType === 'panel-bottom') {
      return [bestCollision];
    }

    if (bestType === 'create-zone') {
      return [bestCollision];
    }

    return filteredCollisions;
  };
}

export const intentAwareCollisionDetection: CollisionDetection = createIntentAwareCollisionDetector();

export function createPriorityCollisionDetector(
  priorityMap: Partial<Record<DropzoneType, number>>
): CollisionDetection {
  const mergedPriorities = { ...DROPZONE_PRIORITIES, ...priorityMap };

  return createIntentAwareCollisionDetector({
    prioritizePointer: true,
  });
}
