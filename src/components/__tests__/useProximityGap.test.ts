import { renderHook } from '@testing-library/react';
import { useProximityGap } from '../../hooks/useProximityGap';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Active } from '@dnd-kit/core';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  })),
  useDndContext: vi.fn(() => ({
    active: null
  }))
}));

const pointerState = {
  pointerPosition: null as { x: number; y: number } | null,
  isDragging: false,
};

vi.mock('../../contexts/PointerPositionContext', () => ({
  usePointerPosition: () => ({
    get pointerPosition() {
      return pointerState.pointerPosition;
    },
    get isDragging() {
      return pointerState.isDragging;
    },
  }),
}));

describe('useProximityGap memory leak', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  const mockActive = { id: 'active-item' } as Active;

  beforeEach(() => {
    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
    pointerState.pointerPosition = null;
    pointerState.isDragging = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should NOT add pointermove listeners at hook level (uses context)', () => {
    const mockNode = document.createElement('div');
    const { rerender, unmount } = renderHook(
      (props: { active: Active | null; isDraggingGroup: boolean }) => {
        const result = useProximityGap('gap-1', props.active, props.isDraggingGroup);
        if (result.ref) {
          result.ref(mockNode);
        }
        return result;
      },
      { initialProps: { active: mockActive as Active | null, isDraggingGroup: false } }
    );

    const pointerAddCalls = addSpy.mock.calls.filter((call: unknown[]) => call[0] === 'pointermove').length;
    expect(pointerAddCalls).toBe(0);

    rerender({ active: null, isDraggingGroup: false });
    
    const pointerRemoveCalls = removeSpy.mock.calls.filter((call: unknown[]) => call[0] === 'pointermove').length;
    expect(pointerRemoveCalls).toBe(0);

    unmount();
  });

  it('should handle rapid toggling without adding listeners at hook level', () => {
    const mockNode = document.createElement('div');
    const { rerender, unmount } = renderHook(
      (props: { active: Active | null }) => {
        const result = useProximityGap('gap-1', props.active);
        if (result.ref) {
          result.ref(mockNode);
        }
        return result;
      },
      { initialProps: { active: mockActive as Active | null } }
    );

    for (let i = 0; i < 10; i++) {
      rerender({ active: null });
      rerender({ active: mockActive });
    }

    const addCount = addSpy.mock.calls.filter((call: unknown[]) => call[0] === 'pointermove').length;
    const removeCount = removeSpy.mock.calls.filter((call: unknown[]) => call[0] === 'pointermove').length;

    expect(addCount).toBe(0);
    expect(removeCount).toBe(0);

    unmount();
    expect(removeSpy.mock.calls.filter((call: unknown[]) => call[0] === 'pointermove').length).toBe(0);
  });
});
