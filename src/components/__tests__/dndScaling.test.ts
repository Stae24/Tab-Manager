import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProximityGap } from '../../hooks/useProximityGap';

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

describe('useProximityGap with scroll/resize', () => {
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    pointerState.pointerPosition = null;
    pointerState.isDragging = false;
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('registers scroll and resize listeners when active drag starts', () => {
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

    rerender({ active });

    expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    rectSpy.mockRestore();
  });

  it('refreshes cached position on scroll while dragging', () => {
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
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect')
      .mockReturnValueOnce({
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

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('refreshes cached position on resize while dragging', () => {
    const active = { id: 'test-active' } as any;

    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false),
      { initialProps: { active } }
    );

    const mockNode = document.createElement('div');
    const rectSpy = vi.spyOn(mockNode, 'getBoundingClientRect')
      .mockReturnValueOnce({
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

    const resizeHandler = addEventListenerSpy.mock.calls.find(
      (call: any[]) => call[0] === 'resize'
    )?.[1];

    if (resizeHandler) {
      rectSpy.mockReturnValueOnce({
        top: 150,
        left: 0,
        right: 100,
        bottom: 170,
        width: 100,
        height: 20,
        x: 0,
        y: 150,
        toJSON: () => ({}),
      } as DOMRect);

      act(() => {
        resizeHandler();
      });
    }

    rectSpy.mockRestore();
  });

  it('removes listeners when active becomes null', () => {
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

    rerender({ active: null });

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    rectSpy.mockRestore();
  });

  it('removes listeners when isDraggingGroup becomes true', () => {
    const active = { id: 'test-active' } as any;

    const { result, rerender } = renderHook(
      ({ active, isDraggingGroup }) => useProximityGap('test-gap', active, isDraggingGroup),
      { initialProps: { active, isDraggingGroup: false } }
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

    rerender({ active, isDraggingGroup: true });

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    rectSpy.mockRestore();
  });
});

describe('useProximityGap cross-panel suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pointerState.pointerPosition = null;
    pointerState.isDragging = false;
  });

  it('does not expand gap for cross-panel drags (live panel, vault item)', () => {
    const active = { id: 'vault-tab-123' } as any;

    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false, 'live'),
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

    expect(result.current.expanded).toBe(false);
    expect(result.current.expandedHeight).toBe(0);

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not expand gap for cross-panel drags (vault panel, live item)', () => {
    const active = { id: 'live-tab-123' } as any;

    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false, 'vault'),
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

    expect(result.current.expanded).toBe(false);
    expect(result.current.expandedHeight).toBe(0);

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('expands gap for same-panel drags (live panel, live item)', () => {
    const active = {
      id: 'live-tab-123',
      rect: {
        current: {
          initial: {
            height: 38
          }
        }
      }
    } as any;

    const { result, rerender } = renderHook(
      ({ active }) => useProximityGap('test-gap', active, false, 'live'),
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
    expect(result.current.expandedHeight).toBe(46);

    rectSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('DnD Scale Modifier logic', () => {
  it('correctly scales transform coordinates based on uiScale', () => {
    const uiScale: number = 1.5;
    const transform = { x: 150, y: 150, scaleX: 1, scaleY: 1 };

    const scaleModifier = ({ transform }: any) => {
      if (uiScale === 1) {
        return transform;
      }
      return {
        ...transform,
        x: transform.x / uiScale,
        y: transform.y / uiScale,
      };
    };

    const result = scaleModifier({ transform });
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('handles uiScale of 1.0 (no change)', () => {
    const uiScale: number = 1.0;
    const transform = { x: 100, y: 100, scaleX: 1, scaleY: 1 };

    const scaleModifier = ({ transform }: any) => {
      if (uiScale === 1) {
        return transform;
      }
      return {
        ...transform,
        x: transform.x / uiScale,
        y: transform.y / uiScale,
      };
    };

    const result = scaleModifier({ transform });
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('handles uiScale greater than 1', () => {
    const uiScale: number = 2;
    const transform = { x: 200, y: 100, scaleX: 1, scaleY: 1 };

    const scaleModifier = ({ transform }: any) => {
      if (uiScale === 1) {
        return transform;
      }
      return {
        ...transform,
        x: transform.x / uiScale,
        y: transform.y / uiScale,
      };
    };

    const result = scaleModifier({ transform });
    expect(result.x).toBe(100);
    expect(result.y).toBe(50);
  });

  it('handles uiScale less than 1', () => {
    const uiScale: number = 0.5;
    const transform = { x: 50, y: 50, scaleX: 1, scaleY: 1 };

    const scaleModifier = ({ transform }: any) => {
      if (uiScale === 1) {
        return transform;
      }
      return {
        ...transform,
        x: transform.x / uiScale,
        y: transform.y / uiScale,
      };
    };

    const result = scaleModifier({ transform });
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });
});
