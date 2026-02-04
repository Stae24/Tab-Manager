import { renderHook } from '@testing-library/react';
import { useProximityGap } from '../Dashboard';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

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

  beforeEach(() => {
    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clean up listeners when active toggles', () => {
    const { rerender, unmount } = renderHook(
      ({ active, isDraggingGroup }: { active: boolean; isDraggingGroup: boolean }) => {
        const result = useProximityGap('gap-1', active, isDraggingGroup);
        if (result.gapRef) {
           (result.gapRef as any).current = document.createElement('div');
        }
        return result;
      },
      { initialProps: { active: true, isDraggingGroup: false } }
    );

    expect(addSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    const initialAddCount = addSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(initialAddCount).toBe(1);

    rerender({ active: false, isDraggingGroup: false });
    const removeCountAfterToggle = removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(removeCountAfterToggle).toBe(1);

    rerender({ active: true, isDraggingGroup: false });
    const addCountAfterBack = addSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(addCountAfterBack).toBe(2);

    unmount();
    const finalRemoveCount = removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    expect(finalRemoveCount).toBe(2);
  });

  it('should handle rapid toggling without accumulating listeners', () => {
    const { rerender, unmount } = renderHook(
      ({ active }: { active: boolean }) => {
        const result = useProximityGap('gap-1', active);
        if (result.gapRef) {
          (result.gapRef as any).current = document.createElement('div');
        }
        return result;
      },
      { initialProps: { active: true } }
    );

    for (let i = 0; i < 10; i++) {
      rerender({ active: false });
      rerender({ active: true });
    }

    const addCount = addSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;
    const removeCount = removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length;

    expect(addCount).toBe(11);
    expect(removeCount).toBe(10);

    unmount();
    expect(removeSpy.mock.calls.filter((call: any[]) => call[0] === 'pointermove').length).toBe(11);
  });
});
