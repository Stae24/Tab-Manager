import { useRef, useCallback } from 'react';
import { Virtualizer } from '@tanstack/react-virtual';

export const useDynamicRowHeight = <T extends Element>(
  virtualizer: Virtualizer<HTMLDivElement, T> | null
) => {
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());

  const measureElement = useCallback((element: T | null) => {
    if (!element || !virtualizer) return;

    const index = parseInt(element.getAttribute('data-index') || '-1', 10);
    if (index < 0) return;

    const height = element.getBoundingClientRect().height;
    if (height > 0) {
      const currentHeight = measuredHeightsRef.current.get(index);
      if (currentHeight !== height) {
        measuredHeightsRef.current.set(index, height);
        virtualizer.measureElement(element);
      }
    }
  }, [virtualizer]);

  const getEstimatedSize = useCallback((index: number): number => {
    return measuredHeightsRef.current.get(index) ?? 40;
  }, []);

  const clearHeights = useCallback(() => {
    measuredHeightsRef.current.clear();
  }, []);

  return {
    measureElement,
    getEstimatedSize,
    clearHeights,
    measuredHeights: measuredHeightsRef.current,
  };
};
