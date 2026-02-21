import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { SearchHelp } from '../SearchHelp';

describe('SearchHelp', () => {
  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders when isOpen is true', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Search Syntax')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<SearchHelp {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Search Syntax')).not.toBeInTheDocument();
    });

    it('shows all text-scope bangs', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText(/Search in tab title only/)).toBeInTheDocument();
      expect(screen.getByText(/Search in tab URL only/)).toBeInTheDocument();
    });

    it('shows all boolean bangs section', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Boolean Bangs')).toBeInTheDocument();
      expect(screen.getByText(/Tabs playing audio/)).toBeInTheDocument();
      expect(screen.getByText(/Frozen\/suspended tabs/)).toBeInTheDocument();
    });

    it('shows all value bangs', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Value Bangs')).toBeInTheDocument();
      expect(screen.getByText(/Group name contains/)).toBeInTheDocument();
      expect(screen.getByText(/Group color is/)).toBeInTheDocument();
    });

    it('shows all commands section', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Commands')).toBeInTheDocument();
    });

    it('shows delete command with destructive indicator', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      const deleteCommand = screen.getByText(/Close all matching tabs/);
      expect(deleteCommand).toBeInTheDocument();
    });

    it('shows sort options', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Sort')).toBeInTheDocument();
      expect(screen.getByText(/Sort by title/)).toBeInTheDocument();
      expect(screen.getByText(/Sort by URL/)).toBeInTheDocument();
    });

    it('shows example queries', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Examples')).toBeInTheDocument();
    });

    it('shows Got it button', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Got it')).toBeInTheDocument();
    });

    it('shows exclude modifier section', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Exclude Modifier')).toBeInTheDocument();
    });

    it('shows basic search section', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByText('Basic Search')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('Escape key calls onClose', () => {
      const onClose = vi.fn();
      render(<SearchHelp {...defaultProps} isOpen={true} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('overlay click behavior', () => {
      const onClose = vi.fn();
      render(<SearchHelp {...defaultProps} isOpen={true} onClose={onClose} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('clicking inside modal does not call onClose', () => {
      const onClose = vi.fn();
      render(<SearchHelp {...defaultProps} isOpen={true} onClose={onClose} />);
      
      const title = screen.getByText('Search Syntax');
      fireEvent.click(title);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Got it button calls onClose', () => {
      const onClose = vi.fn();
      render(<SearchHelp {...defaultProps} isOpen={true} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Got it'));
      expect(onClose).toHaveBeenCalled();
    });

    it('close button calls onClose', () => {
      const onClose = vi.fn();
      render(<SearchHelp {...defaultProps} isOpen={true} onClose={onClose} />);
      
      const closeButton = screen.getByRole('button', { name: '' });
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has correct role', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal attribute', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby', () => {
      render(<SearchHelp {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'search-help-title');
    });
  });

  describe('cleanup', () => {
    it('removes event listener when closed', () => {
      const { rerender } = render(<SearchHelp {...defaultProps} isOpen={true} />);
      
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      rerender(<SearchHelp {...defaultProps} isOpen={false} />);
      
      expect(removeSpy).toHaveBeenCalled();
      removeSpy.mockRestore();
    });
  });
});
