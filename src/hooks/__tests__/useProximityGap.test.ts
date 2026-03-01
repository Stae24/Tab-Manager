import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProximityGap } from '../useProximityGap';

const mockSetNodeRef = vi.fn();

vi.mock('@dnd-kit/core', () => ({
  useDroppable: vi.fn(() => ({
    setNodeRef: mockSetNodeRef,
    isOver: false,
  })),
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

describe('useProximityGap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pointerState.pointerPosition = null;
    pointerState.isDragging = false;
  });

  it('returns ref, isOver, and expanded state', () => {
    const { result } = renderHook(() => 
      useProximityGap('test-gap', null, false)
    );

    expect(result.current).toHaveProperty('ref');
    expect(result.current).toHaveProperty('isOver');
    expect(result.current).toHaveProperty('expanded');
    expect(result.current).toHaveProperty('expandedHeight');
    expect(result.current.expanded).toBe(false);
    expect(result.current.expandedHeight).toBe(0);
  });

  it('sets expanded to false when active is null', () => {
    const { result } = renderHook(() => 
      useProximityGap('test-gap', null, false)
    );

    expect(result.current.expanded).toBe(false);
  });

  it('sets expanded to false when isDraggingGroup is true', () => {
    const active = { id: 'test-active' } as any;
    
    const { result } = renderHook(() => 
      useProximityGap('test-gap', active, true)
    );

    expect(result.current.expanded).toBe(false);
  });

  it('calls setNodeRef when ref callback is invoked', () => {
    const { result } = renderHook(() => 
      useProximityGap('test-gap', null, false)
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

    expect(mockSetNodeRef).toHaveBeenCalledWith(mockNode);
  });

  it('returns isOver from useDroppable', () => {
    const { result } = renderHook(() => 
      useProximityGap('test-gap', null, false)
    );

    expect(result.current.isOver).toBe(false);
  });

  it('combines ref with setNodeRef correctly', () => {
    const { result } = renderHook(() => 
      useProximityGap('test-gap', null, false)
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

    expect(mockSetNodeRef).toHaveBeenCalledTimes(1);
    expect(mockSetNodeRef).toHaveBeenCalledWith(mockNode);
  });

  it('sets expanded to false when active becomes null after being set', () => {
    const active = { id: 'test-active' } as any;
    
    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    rerender({ active: null });

    expect(result.current.expanded).toBe(false);
  });

  it('reads pointer position from context instead of adding listeners', () => {
    const active = { id: 'test-active' } as any;
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    const { result } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('pointermove', expect.any(Function));

    addEventListenerSpy.mockRestore();
  });

  it('handles rapid active changes without memory leaks', () => {
    const active1 = { id: 'test-active-1' } as any;
    const active2 = { id: 'test-active-2' } as any;
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active: active1 } }
    );

    rerender({ active: active2 });
    rerender({ active: active1 });
    rerender({ active: null });

    expect(removeEventListenerSpy).not.toHaveBeenCalledWith('pointermove', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });

  it('expands gap when pointer is within vertical threshold below gap', () => {
    const active = { 
      id: 'test-active',
      rect: {
        current: {
          initial: {
            height: 38
          }
        }
      }
    } as any;
    
    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 20,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    
    vi.stubGlobal('getComputedStyle', vi.fn().mockReturnValue({ fontSize: '16px' }));

    act(() => {
      result.current.ref(mockNode);
    });

    pointerState.pointerPosition = { x: 50, y: 110 };
    rerender({ active });

    expect(result.current.expanded).toBe(true);
    expect(result.current.expandedHeight).toBe(46); // 38 + 8 (VIRTUAL_ROW_GAP_PX)

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('expands gap when pointer is within vertical threshold above gap', () => {
    const active = { 
      id: 'test-active',
      rect: {
        current: {
          initial: {
            height: 40
          }
        }
      }
    } as any;
    
    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 20,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    
    vi.stubGlobal('getComputedStyle', vi.fn().mockReturnValue({ fontSize: '16px' }));

    act(() => {
      result.current.ref(mockNode);
    });

    pointerState.pointerPosition = { x: 50, y: 90 };
    rerender({ active });

    expect(result.current.expanded).toBe(true);
    expect(result.current.expandedHeight).toBe(48); // 40 + 8 (VIRTUAL_ROW_GAP_PX)

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not expand when pointer is outside horizontal bounds', () => {
    const active = { id: 'test-active' } as any;
    
    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 20,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    act(() => {
      result.current.ref(mockNode);
    });

    pointerState.pointerPosition = { x: 150, y: 110 };
    rerender({ active });

    expect(result.current.expanded).toBe(false);
    expect(result.current.expandedHeight).toBe(0);

    rectSpy.mockRestore();
  });

  it('does not expand when pointer is too far below gap', () => {
    const active = { id: 'test-active' } as any;
    
    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 20,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    vi.stubGlobal('getComputedStyle', vi.fn().mockReturnValue({ fontSize: '16px' }));

    act(() => {
      result.current.ref(mockNode);
    });

    pointerState.pointerPosition = { x: 50, y: 200 };
    rerender({ active });

    expect(result.current.expanded).toBe(false);
    expect(result.current.expandedHeight).toBe(0);

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not expand when pointerPosition is null', () => {
    const active = { id: 'test-active' } as any;
    pointerState.pointerPosition = null;
    
    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 20,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    act(() => {
      result.current.ref(mockNode);
    });

    pointerState.pointerPosition = null;
    rerender({ active });

    expect(result.current.expanded).toBe(false);
    expect(result.current.expandedHeight).toBe(0);

    rectSpy.mockRestore();
  });

  it('sets expandedHeight from active.rect.current.initial.height when expanded', () => {
    const active = { 
      id: 'test-active',
      rect: {
        current: {
          initial: {
            height: 45
          }
        }
      }
    } as any;
    
    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      left: 0,
      right: 100,
      bottom: 120,
      width: 100,
      height: 20,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    
    vi.stubGlobal('getComputedStyle', vi.fn().mockReturnValue({ fontSize: '16px' }));

    act(() => {
      result.current.ref(mockNode);
    });

    pointerState.pointerPosition = { x: 50, y: 110 };
    rerender({ active });

    expect(result.current.expanded).toBe(true);
    expect(result.current.expandedHeight).toBe(53); // 45 + 8 (VIRTUAL_ROW_GAP_PX)

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
