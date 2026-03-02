import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Active, DroppableContainer, ClientRect } from '@dnd-kit/core';
import {
  createIntentAwareCollisionDetector,
  intentAwareCollisionDetection,
} from '../dnd/collisionDetection';

// Mock the store utils
vi.mock('../../store/utils', () => ({
  isVaultId: (id: string) => id.startsWith('vault-'),
  isLiveId: (id: string) => id.startsWith('live-'),
}));

// Mock @dnd-kit/core collision algorithms
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    pointerWithin: vi.fn((args) => {
      // Simple mock that returns collisions based on pointer coordinates
      const { droppableRects, pointerCoordinates } = args;
      if (!pointerCoordinates) return [];

      const collisions = [];
      for (const [id, rect] of droppableRects.entries()) {
        if (
          pointerCoordinates.x >= rect.left &&
          pointerCoordinates.x <= rect.right &&
          pointerCoordinates.y >= rect.top &&
          pointerCoordinates.y <= rect.bottom
        ) {
          collisions.push({ id, data: { value: 0 } });
        }
      }
      return collisions;
    }),
    closestCorners: vi.fn((args) => {
      // Mock that returns all droppables as collisions
      const { droppableRects } = args;
      const collisions = [];
      for (const [id] of droppableRects.entries()) {
        collisions.push({ id, data: { value: Math.random() } });
      }
      return collisions;
    }),
    closestCenter: vi.fn((args) => {
      const { droppableRects } = args;
      const collisions = [];
      for (const [id] of droppableRects.entries()) {
        collisions.push({ id, data: { value: Math.random() } });
      }
      return collisions;
    }),
  };
});

describe('collisionDetection', () => {
  const mockDroppableContainer = (id: string): DroppableContainer => ({
    id,
    key: id,
    disabled: false,
    node: { current: null as unknown as HTMLElement },
    rect: { current: null },
    data: { current: undefined },
  });

  const createMockArgs = (overrides: Partial<{
    active: Active | null;
    collisionRect: ClientRect;
    droppableRects: Map<string, ClientRect>;
    droppableContainers: DroppableContainer[];
    pointerCoordinates: { x: number; y: number } | null;
  }> = {}) => {
    const active = overrides.active ?? {
      id: 'live-tab-123',
      data: { current: undefined },
      rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
    } as Active;

    return {
      active,
      collisionRect: { width: 100, height: 40, top: 0, left: 0, right: 100, bottom: 40 } as ClientRect,
      droppableRects: new Map<string, ClientRect>(),
      droppableContainers: [] as DroppableContainer[],
      pointerCoordinates: { x: 50, y: 20 } as { x: number; y: number },
      ...overrides,
    };
  };

  describe('createIntentAwareCollisionDetector', () => {
    it('should return a collision detection function', () => {
      const detector = createIntentAwareCollisionDetector();
      expect(typeof detector).toBe('function');
    });

    it('should return empty array when no active item', () => {
      const detector = createIntentAwareCollisionDetector();
      const args = createMockArgs({ active: null });
      const result = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);
      expect(result).toEqual([]);
    });
  });

  describe('same-panel drag intent', () => {
    it('should prioritize item targets over panel root when dragging in same panel', () => {
      const detector = createIntentAwareCollisionDetector();

      // Pointer is over the item, not the panel
      const args = createMockArgs({
        active: {
          id: 'live-tab-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['live-tab-456', { top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40 }],
          ['live-panel-dropzone', { top: 0, left: 0, right: 200, bottom: 200, width: 200, height: 200 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('live-tab-456'),
          mockDroppableContainer('live-panel-dropzone'),
        ],
        pointerCoordinates: { x: 50, y: 20 }, // Pointer inside live-tab-456
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      expect(collisions.length).toBeGreaterThan(0);
      const hasItemTarget = collisions.some(c => String(c.id) === 'live-tab-456');
      expect(hasItemTarget).toBe(true);
    });

    it('should prioritize gap targets over panel root when dragging in same panel', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'live-tab-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['live-gap-1', { top: 40, left: 0, right: 100, bottom: 44, width: 100, height: 4 }],
          ['live-panel-dropzone', { top: 0, left: 0, right: 200, bottom: 200, width: 200, height: 200 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('live-gap-1'),
          mockDroppableContainer('live-panel-dropzone'),
        ],
        pointerCoordinates: { x: 50, y: 42 }, // Pointer inside live-gap-1
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      expect(collisions.length).toBeGreaterThan(0);
      const gapTargets = collisions.filter(c => String(c.id).includes('-gap-'));
      expect(gapTargets.length).toBeGreaterThan(0);
    });
  });

  describe('cross-panel drag intent', () => {
    it('should resolve to destination panel dropzone when dragging from live to vault', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'live-tab-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['vault-dropzone', { top: 0, left: 200, right: 400, bottom: 400, width: 200, height: 400 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('vault-dropzone'),
        ],
        pointerCoordinates: { x: 300, y: 100 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      expect(collisions.length).toBeGreaterThan(0);
      const hasVaultTarget = collisions.some(c => String(c.id) === 'vault-dropzone');
      expect(hasVaultTarget).toBe(true);
    });

    it('should resolve to destination panel dropzone when dragging from vault to live', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'vault-tab-456-789',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['live-panel-dropzone', { top: 0, left: 0, right: 200, bottom: 400, width: 200, height: 400 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('live-panel-dropzone'),
        ],
        pointerCoordinates: { x: 100, y: 100 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      expect(collisions.length).toBeGreaterThan(0);
      const hasLiveTarget = collisions.some(c => String(c.id) === 'live-panel-dropzone');
      expect(hasLiveTarget).toBe(true);
    });
  });

  describe('create-zone eligibility', () => {
    it('should resolve create-zone for eligible live tab drag', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'live-tab-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['create-island-dropzone', { top: 300, left: 50, right: 150, bottom: 400, width: 100, height: 100 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('create-island-dropzone'),
        ],
        pointerCoordinates: { x: 100, y: 350 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      const hasCreateZone = collisions.some(c => String(c.id) === 'create-island-dropzone');
      expect(hasCreateZone).toBe(true);
    });

    it('should NOT resolve create-zone for live group drag', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'live-group-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['create-island-dropzone', { top: 300, left: 50, right: 150, bottom: 400, width: 100, height: 100 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('create-island-dropzone'),
        ],
        pointerCoordinates: { x: 100, y: 350 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      const hasCreateZone = collisions.some(c => String(c.id) === 'create-island-dropzone');
      expect(hasCreateZone).toBe(false);
    });

    it('should NOT resolve create-zone for vault item drag', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'vault-tab-456-789',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['create-island-dropzone', { top: 300, left: 50, right: 150, bottom: 400, width: 100, height: 100 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('create-island-dropzone'),
        ],
        pointerCoordinates: { x: 100, y: 350 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      const hasCreateZone = collisions.some(c => String(c.id) === 'create-island-dropzone');
      expect(hasCreateZone).toBe(false);
    });

    it('should NOT resolve create-zone for vault group drag', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'vault-group-456-789',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['create-island-dropzone', { top: 300, left: 50, right: 150, bottom: 400, width: 100, height: 100 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('create-island-dropzone'),
        ],
        pointerCoordinates: { x: 100, y: 350 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      const hasCreateZone = collisions.some(c => String(c.id) === 'create-island-dropzone');
      expect(hasCreateZone).toBe(false);
    });
  });

  describe('panel bottom targets', () => {
    it('should resolve to panel-bottom for cross-panel drag when no item targets exist', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'live-tab-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['vault-bottom', { top: 350, left: 200, right: 400, bottom: 400, width: 200, height: 50 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('vault-bottom'),
        ],
        pointerCoordinates: { x: 300, y: 375 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      const hasBottomTarget = collisions.some(c => String(c.id) === 'vault-bottom');
      expect(hasBottomTarget).toBe(true);
    });
  });

  describe('priority ordering', () => {
    it('should return item and gap targets first before panel targets', () => {
      const detector = createIntentAwareCollisionDetector();

      // Pointer is over items/gaps, not panel
      const args = createMockArgs({
        active: {
          id: 'live-tab-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['live-tab-456', { top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40 }],
          ['live-gap-1', { top: 40, left: 0, right: 100, bottom: 44, width: 100, height: 4 }],
          ['live-panel-dropzone', { top: 0, left: 0, right: 200, bottom: 200, width: 200, height: 200 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('live-tab-456'),
          mockDroppableContainer('live-gap-1'),
          mockDroppableContainer('live-panel-dropzone'),
        ],
        pointerCoordinates: { x: 50, y: 20 }, // Over item/gap area
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      expect(collisions.length).toBeGreaterThan(0);

      const firstCollision = collisions[0];
      const firstId = String(firstCollision.id);
      const isHighPriority = firstId.startsWith('live-tab-') || firstId.includes('-gap-');
      expect(isHighPriority).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty droppable containers', () => {
      const detector = createIntentAwareCollisionDetector();
      const args = createMockArgs({
        droppableRects: new Map<string, ClientRect>(),
        droppableContainers: [],
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);
      expect(collisions).toEqual([]);
    });

    it('should handle unknown ID formats as item type', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'unknown-item-123',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['some-random-id', { top: 0, left: 0, right: 100, bottom: 40, width: 100, height: 40 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('some-random-id'),
        ],
        pointerCoordinates: { x: 50, y: 20 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);
      expect(collisions.length).toBeGreaterThan(0);
    });

    it('should filter out all targets if create-zone is only target but ineligible', () => {
      const detector = createIntentAwareCollisionDetector();

      const args = createMockArgs({
        active: {
          id: 'vault-tab-456-789',
          data: { current: undefined },
          rect: { current: { initial: null, translated: null } as unknown as Active['rect']['current'] },
        } as Active,
        droppableRects: new Map<string, ClientRect>([
          ['create-island-dropzone', { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }],
        ]),
        droppableContainers: [
          mockDroppableContainer('create-island-dropzone'),
        ],
        pointerCoordinates: { x: 50, y: 50 },
      });

      const collisions = detector(args as Parameters<typeof intentAwareCollisionDetection>[0]);

      const hasCreateZone = collisions.some(c => String(c.id) === 'create-island-dropzone');
      expect(hasCreateZone).toBe(false);
    });
  });
});
