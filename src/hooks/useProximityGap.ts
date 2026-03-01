import { useState, useEffect, useRef, useCallback } from 'react';
import { useDroppable, Active } from '@dnd-kit/core';
import { usePointerPosition } from '../contexts/PointerPositionContext';
import { BASE_FONT_SIZE, VIRTUAL_ROW_GAP_PX, PROXIMITY_THRESHOLD_UP_REM, PROXIMITY_THRESHOLD_DOWN_REM } from '../constants';
import { isVaultId, isLiveId } from '../store/utils';

export const useProximityGap = (gapId: string, active: Active | null, isDraggingGroup?: boolean, panelType?: 'live' | 'vault') => {
  const { pointerPosition } = usePointerPosition();
  const { setNodeRef, isOver } = useDroppable({ id: gapId });
  const gapRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(0);

  const cachedPositionRef = useRef<{ top: number; left: number; right: number } | null>(null);
  const lastDragIdRef = useRef<string | null>(null);
  const lastCalculationRef = useRef<{ x: number; y: number } | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    gapRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  useEffect(() => {
    if (!active || isDraggingGroup) {
      cachedPositionRef.current = null;
      lastDragIdRef.current = null;
      setExpanded(false);
      setExpandedHeight(0);
      return;
    }

    const activeId = String(active.id);

    if (activeId !== lastDragIdRef.current && gapRef.current) {
      const rect = gapRef.current.getBoundingClientRect();
      cachedPositionRef.current = {
        top: rect.top,
        left: rect.left,
        right: rect.right
      };
      lastDragIdRef.current = activeId;
    }
  }, [active, isDraggingGroup]);

  useEffect(() => {
    if (!active || !gapRef.current || isDraggingGroup) {
      setExpanded(false);
      setExpandedHeight(0);
      return;
    }

    const activeId = String(active.id);

    // Consolidated cross-panel drag check
    const isCrossPanelDrag =
      (panelType === 'live' && isVaultId(activeId)) ||
      (panelType === 'vault' && isLiveId(activeId));

    if (isCrossPanelDrag) {
      setExpanded(false);
      setExpandedHeight(0);
      return;
    }

    if (!pointerPosition) {
      setExpanded(false);
      return;
    }

    // Performance optimization: only recalculate when pointer moves significantly
    const shouldRecalculate = !lastCalculationRef.current ||
      Math.abs(pointerPosition.x - lastCalculationRef.current.x) > 2 ||
      Math.abs(pointerPosition.y - lastCalculationRef.current.y) > 2;

    if (!shouldRecalculate) {
      // Use cached values - state is already set from previous calculation
      return;
    }

    if (!cachedPositionRef.current) {
      const rect = gapRef.current.getBoundingClientRect();
      cachedPositionRef.current = {
        top: rect.top,
        left: rect.left,
        right: rect.right
      };
    }

    lastCalculationRef.current = { x: pointerPosition.x, y: pointerPosition.y };

    const gapRect = cachedPositionRef.current;
    const baseRem = parseFloat(getComputedStyle(document.documentElement).fontSize) || BASE_FONT_SIZE;
    const pointerY = pointerPosition.y;

    const distance = pointerY - gapRect.top;

    // Use named constants for thresholds
    const expandUp = distance < 0 && Math.abs(distance) < PROXIMITY_THRESHOLD_UP_REM * baseRem;
    const expandDown = distance >= 0 && distance < PROXIMITY_THRESHOLD_DOWN_REM * baseRem;
    const isWithinHorizontal = pointerPosition.x >= gapRect.left && pointerPosition.x <= gapRect.right;

    const shouldExpand = (expandUp || expandDown) && isWithinHorizontal;
    setExpanded(shouldExpand);

    // Explicit height null safety with fallback
    if (shouldExpand && active.rect?.current?.initial?.height != null) {
      setExpandedHeight(active.rect.current.initial.height + VIRTUAL_ROW_GAP_PX);
    } else if (shouldExpand) {
      // Fallback height if rect info unavailable
      setExpandedHeight(VIRTUAL_ROW_GAP_PX);
    } else {
      setExpandedHeight(0);
    }

    // Cleanup function
    return () => {
      // Reset cached calculation on unmount or before next effect run
      // Note: we don't reset expanded state here as it's handled by dependencies
    };
  }, [active, isDraggingGroup, pointerPosition, panelType]);

  return { ref, isOver, expanded, expandedHeight };
};
