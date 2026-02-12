import { useState, useEffect, useRef, useCallback } from 'react';
import { useDroppable, Active } from '@dnd-kit/core';
import { BASE_FONT_SIZE } from '../constants';

export const useProximityGap = (gapId: string, active: Active | null, isDraggingGroup?: boolean) => {
  const { setNodeRef, isOver } = useDroppable({ id: gapId });
  const gapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const handlerRef = useRef<((e: PointerEvent) => void) | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    gapRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  useEffect(() => {
    const cleanup = () => {
      if (handlerRef.current) {
        document.removeEventListener('pointermove', handlerRef.current);
        handlerRef.current = null;
      }
    };

    if (!active || !gapRef.current || isDraggingGroup) {
      setExpanded(false);
      cleanup();
      return cleanup;
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!gapRef.current) return;

      const gapRect = gapRef.current.getBoundingClientRect();
      const baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_FONT_SIZE;
      const pointerY = e.clientY;

      const distance = pointerY - gapRect.top;

      const expandUp = distance < 0 && Math.abs(distance) < 1 * baseRem;
      const expandDown = distance >= 0 && distance < 3 * baseRem;
      const isWithinHorizontal = e.clientX >= gapRect.left && e.clientX <= gapRect.right;

      setExpanded((expandUp || expandDown) && isWithinHorizontal);
    };

    cleanup();
    handlerRef.current = handlePointerMove;
    document.addEventListener('pointermove', handlePointerMove);

    return cleanup;
  }, [active, isDraggingGroup]);

  return { ref, isOver, expanded };
};
