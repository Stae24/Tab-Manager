import { useState, useEffect, useRef, useCallback } from 'react';
import { useDroppable, Active } from '@dnd-kit/core';
import { usePointerPosition } from '../contexts/PointerPositionContext';
import { BASE_FONT_SIZE } from '../constants';

export const useProximityGap = (gapId: string, active: Active | null, isDraggingGroup?: boolean) => {
  const { pointerPosition } = usePointerPosition();
  const { setNodeRef, isOver } = useDroppable({ id: gapId });
  const gapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const ref = useCallback((node: HTMLDivElement | null) => {
    gapRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  useEffect(() => {
    if (!active || !gapRef.current || isDraggingGroup) {
      setExpanded(false);
      return;
    }

    if (!pointerPosition) {
      setExpanded(false);
      return;
    }

    const gapRect = gapRef.current.getBoundingClientRect();
    const baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_FONT_SIZE;
    const pointerY = pointerPosition.y;

    const distance = pointerY - gapRect.top;

    const expandUp = distance < 0 && Math.abs(distance) < 1 * baseRem;
    const expandDown = distance >= 0 && distance < 3 * baseRem;
    const isWithinHorizontal = pointerPosition.x >= gapRect.left && pointerPosition.x <= gapRect.right;

    setExpanded((expandUp || expandDown) && isWithinHorizontal);
  }, [active, isDraggingGroup, pointerPosition]);

  return { ref, isOver, expanded };
};
