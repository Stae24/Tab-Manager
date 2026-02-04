import { renderHook } from '@testing-library/react';
import { useProximityGap } from '../Dashboard';
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

describe('useProximityGap memory leak', () => {
  let addSpy: any;
  let removeSpy: any;

  const mockActive = { id: 'active-item' } as Active;

  beforeEach(() => {
    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clean up listeners when active toggles', () => {
    const { rerender, unmount } = renderHook(
      (props: { active: Active | null; isDraggingGroup: boolean }) => {
        const result = useProximityGap('gap-1', props.active, props.isDraggingGroup);
        if (result.gapRef) {
           (result.gapRef as any).current = document.createElement('div');
        }
        return result;
      },
      { initialProps: { active: mockActive as Active | null, isDraggingGroup: false } }
    );

    expect(addSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    const initialAddCount = addSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(initialAddCount).toBe(1);

    rerender({ active: null, isDraggingGroup: false });
    const removeCountAfterToggle = removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(removeCountAfterToggle).toBe(1);

    rerender({ active: mockActive, isDraggingGroup: false });
    const addCountAfterBack = addSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(addCountAfterBack).toBe(2);

    unmount();
    const finalRemoveCount = removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(finalRemoveCount).toBe(2);
  });

  it('should handle rapid toggling without accumulating listeners', () => {
    const { rerender, unmount } = renderHook(
      (props: { active: Active | null }) => {
        const result = useProximityGap('gap-1', props.active);
        if (result.gapRef) {
          (result.gapRef as any).current = document.createElement('div');
        }
        return result;
      },
      { initialProps: { active: mockActive as Active | null } }
    );

    for (let i = 0; i < 10; i++) {
      rerender({ active: null });
      rerender({ active: mockActive });
    }

    const addCount = addSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    const removeCount = removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;

    expect(addCount).toBe(11);
    expect(removeCount).toBe(10);

    unmount();
    expect(removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length).toBe(11);
  });
});
