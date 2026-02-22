import React from 'react';
import { useDndContext } from '@dnd-kit/core';
import { useProximityGap } from '../hooks/useProximityGap';
import { cn } from '../utils/cn';

interface DroppableGapProps {
  index: number;
  panelType: 'live' | 'vault';
  isDraggingGroup?: boolean;
}

export const DroppableGap: React.FC<DroppableGapProps> = ({ index, panelType, isDraggingGroup }) => {
  const { active } = useDndContext();
  const gapId = `${panelType}-gap-${index}`;
  const { ref, expanded } = useProximityGap(
    gapId,
    active,
    isDraggingGroup
  );

  return (
    <div
      ref={ref}
      className={cn(
        "w-full rounded transition-all duration-200 ease-out pointer-events-none",
        !expanded && "h-0",
        expanded && "h-[2.375rem]"
      )}
    />
  );
};
