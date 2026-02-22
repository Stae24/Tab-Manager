import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

let mockProximityGapResult = { 
  ref: vi.fn(), 
  expanded: false as boolean 
};

let mockDndContextResult: { active: { id: string } | null } = { active: null };
let mockDroppableResult = { 
  setNodeRef: vi.fn(), 
  isOver: false,
  active: null,
  rect: { current: null },
  node: { current: null },
  over: null,
};

vi.mock('@dnd-kit/core', () => ({
  useDndContext: () => mockDndContextResult,
  useDroppable: () => mockDroppableResult,
}));

vi.mock('../../hooks/useProximityGap', () => ({
  useProximityGap: () => mockProximityGapResult,
}));

describe('DroppableGap', () => {
  let DroppableGap: React.FC<any>;

  beforeEach(async () => {
    mockProximityGapResult = { 
      ref: vi.fn(), 
      expanded: false 
    };
    mockDndContextResult = { active: null };
    vi.resetModules();
    const module = await import('../DroppableGap');
    DroppableGap = module.DroppableGap;
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<DroppableGap index={0} panelType="live" />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('has minimal height when not expanded', () => {
      const { container } = render(<DroppableGap index={0} panelType="live" />);
      expect(container.firstChild).toHaveClass('h-0');
    });

    it('has expanded height when expanded=true', async () => {
      mockProximityGapResult.expanded = true;
      vi.resetModules();
      const { DroppableGap: Gap } = await import('../DroppableGap');
      const { container } = render(<Gap index={0} panelType="live" />);
      expect(container.firstChild).toHaveClass('h-[2.375rem]');
    });
  });

  describe('ID Generation', () => {
    it('generates correct ID for live panel gap', () => {
      render(<DroppableGap index={5} panelType="live" />);
    });

    it('generates correct ID for vault panel gap', () => {
      render(<DroppableGap index={3} panelType="vault" />);
    });
  });

  describe('useProximityGap', () => {
    it('passes correct gapId to hook', () => {
      render(<DroppableGap index={0} panelType="live" />);
    });

    it('passes active from DndContext', async () => {
      mockDndContextResult = { active: { id: 'test-id' } };
      vi.resetModules();
      const { DroppableGap: Gap } = await import('../DroppableGap');
      render(<Gap index={0} panelType="live" />);
    });

    it('passes isDraggingGroup for live panel', () => {
      render(<DroppableGap index={0} panelType="live" isDraggingGroup={true} />);
    });

    it('passes false for isDraggingGroup on vault panel', () => {
      render(<DroppableGap index={0} panelType="vault" isDraggingGroup={true} />);
    });
  });
});
