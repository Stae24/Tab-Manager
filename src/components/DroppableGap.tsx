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
  const { ref, isOver, expanded } = useProximityGap(
    gapId,
    active,
    panelType === 'live' ? isDraggingGroup : false
  );

  return (
    <div
      ref={ref}
      className={cn(
        "w-full rounded transition-all duration-200 ease-out pointer-events-none",
        !expanded && "h-0",
        expanded && "h-[2.375rem]",
        isOver && expanded && "bg-gx-accent/20"
      )}
    />
  );
};
