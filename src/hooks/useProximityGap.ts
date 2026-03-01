import { useState, useEffect, useRef, useCallback } from 'react';
import { useDroppable, Active } from '@dnd-kit/core';
import { usePointerPosition } from '../contexts/PointerPositionContext';
import { BASE_FONT_SIZE } from '../constants';
import { isVaultId, isLiveId } from '../store/utils';

export const useProximityGap = (gapId: string, active: Active | null, isDraggingGroup?: boolean, panelType?: 'live' | 'vault') => {
  const { pointerPosition } = usePointerPosition();
  const { setNodeRef, isOver } = useDroppable({ id: gapId });
  const gapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);

  const ref = useCallback((node: HTMLDivElement | null) => {
    gapRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  useEffect(() => {
    if (!active || !gapRef.current || isDraggingGroup) {
      setExpanded(false);
      setExpandedHeight(0);
      return;
    }

    const activeId = String(active.id);
    const isVaultItem = isVaultId(activeId);
    const isLiveItem = isLiveId(activeId);

    if (panelType === 'live' && isVaultItem) {
      setExpanded(false);
      return;
    }
    if (panelType === 'vault' && isLiveItem) {
      setExpanded(false);
      return;
    }

    if (!pointerPosition) {
      setExpanded(false);
      return;
    }

    const gapRect = gapRef.current.getBoundingClientRect();
    if (!gapRect) {
      setExpanded(false);
      return;
    }

    const baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_FONT_SIZE;
    const pointerY = pointerPosition.y;

    const distance = pointerY - gapRect.top;

    const expandUp = distance < 0 && Math.abs(distance) < 1 * baseRem;
    const expandDown = distance >= 0 && distance < 3 * baseRem;
    const isWithinHorizontal = pointerPosition.x >= gapRect.left && pointerPosition.x <= gapRect.right;

    const shouldExpand = (expandUp || expandDown) && isWithinHorizontal;
    setExpanded(shouldExpand);

    if (shouldExpand && active.rect.current && active.rect.current.initial) {
      setExpandedHeight(active.rect.current.initial.height);
    } else {
      setExpandedHeight(0);
    }
  }, [active, isDraggingGroup, pointerPosition, panelType]);

  return { ref, isOver, expanded, expandedHeight };
};
