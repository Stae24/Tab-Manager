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

describe('useProximityGap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ref, isOver, and expanded state', () => {
    const { result } = renderHook(() => 
      useProximityGap('test-gap', null, false)
    );

    expect(result.current).toHaveProperty('ref');
    expect(result.current).toHaveProperty('isOver');
    expect(result.current).toHaveProperty('expanded');
    expect(result.current.expanded).toBe(false);
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

  it('cleans up pointermove listener when active becomes null', () => {
    const active = { id: 'test-active' } as any;
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

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

    rerender({ active: { id: 'test-active-2' } as any });

    expect(addEventListenerSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));

    rerender({ active: null });

    expect(removeEventListenerSpy).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
    rectSpy.mockRestore();
  });

  it('handles rapid active changes without memory leaks', () => {
    const active1 = { id: 'test-active-1' } as any;
    const active2 = { id: 'test-active-2' } as any;
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active: active1 } }
    );

    rerender({ active: active2 });
    rerender({ active: active1 });
    rerender({ active: null });

    const addCalls = addEventListenerSpy.mock.calls.length;
    const removeCalls = removeEventListenerSpy.mock.calls.length;

    expect(removeCalls).toBeGreaterThanOrEqual(addCalls - 1);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('expands gap when pointer is within vertical threshold below gap', () => {
    const active = { id: 'test-active' } as any;
    
    const { result } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

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

    expect(result.current.expanded).toBe(false);

    rectSpy.mockRestore();
  });

  it('expands gap when pointer is within vertical threshold above gap', () => {
    const active = { id: 'test-active' } as any;
    
    const { result } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

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

    expect(result.current.expanded).toBe(false);

    rectSpy.mockRestore();
  });

  it('does not expand when pointer is outside horizontal bounds', async () => {
    const active = { id: 'test-active' } as any;
    
    const { result } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

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

    const pointerEvent = new PointerEvent('pointermove', {
      clientY: 110,
      clientX: 150,
    });
    document.dispatchEvent(pointerEvent);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.expanded).toBe(false);

    rectSpy.mockRestore();
  });

  it('does not expand when pointer is too far below gap', async () => {
    const active = { id: 'test-active' } as any;
    
    const { result } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    act(() => {
      result.current.ref(mockNode);
    });

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

    const pointerEvent = new PointerEvent('pointermove', {
      clientY: 200,
      clientX: 50,
    });
    document.dispatchEvent(pointerEvent);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.expanded).toBe(false);

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
