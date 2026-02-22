import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CompressionWarning } from '../CompressionWarning';
import type { CompressionTier } from '../../types/index';

describe('CompressionWarning', () => {
    describe('Tier: full', () => {
        it('should return null for full tier', () => {
            const { container } = render(
                <CompressionWarning tier="full" onDismiss={vi.fn()} />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('Tier: minimal', () => {
        it('should show minimal tier message', () => {
            render(<CompressionWarning tier="minimal" onDismiss={vi.fn()} />);

            expect(screen.getByText(/visual data removed/i)).toBeInTheDocument();
            expect(screen.getByText(/colors, favicons/i)).toBeInTheDocument();
        });

        it('should render warning icon', () => {
            render(<CompressionWarning tier="minimal" onDismiss={vi.fn()} />);

            // Icon is an SVG without accessible role
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render dismiss button', () => {
            render(<CompressionWarning tier="minimal" onDismiss={vi.fn()} />);

            expect(screen.getByText('Dismiss')).toBeInTheDocument();
        });

        it('should call onDismiss when dismiss button clicked', async () => {
            const onDismiss = vi.fn();
            render(<CompressionWarning tier="minimal" onDismiss={onDismiss} />);

            await userEvent.click(screen.getByText('Dismiss'));
            expect(onDismiss).toHaveBeenCalledTimes(1);
        });
    });

    describe('Tier: no_favicons', () => {
        it('should show no_favicons tier message', () => {
            const tier: CompressionTier = 'no_favicons';
            render(<CompressionWarning tier={tier} onDismiss={vi.fn()} />);

            expect(screen.getByText(/Favicons removed/i)).toBeInTheDocument();
        });

        it('should render warning icon', () => {
            const tier: CompressionTier = 'no_favicons';
            render(<CompressionWarning tier={tier} onDismiss={vi.fn()} />);

            // Icon is an SVG without accessible role
            const svg = document.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('should call onDismiss when dismiss button clicked', async () => {
            const tier: CompressionTier = 'no_favicons';
            const onDismiss = vi.fn();
            render(<CompressionWarning tier={tier} onDismiss={onDismiss} />);

            await userEvent.click(screen.getByText('Dismiss'));
            expect(onDismiss).toHaveBeenCalledTimes(1);
        });
    });

    describe('Styling', () => {
        it('should apply warning styling classes', () => {
            const { container } = render(
                <CompressionWarning tier="minimal" onDismiss={vi.fn()} />
            );

            const warningDiv = container.firstChild;
            expect(warningDiv).toHaveClass('flex items-center justify-between');
            expect(warningDiv).toHaveClass('px-3 py-2 text-sm rounded-md mb-2');
            expect(warningDiv).toHaveClass('bg-yellow-500/20');
            expect(warningDiv).toHaveClass('border border-yellow-500/40');
            expect(warningDiv).toHaveClass('text-yellow-400');
        });

        it('should apply dismiss button styling', () => {
            render(<CompressionWarning tier="minimal" onDismiss={vi.fn()} />);

            const dismissButton = screen.getByText('Dismiss');
            expect(dismissButton).toHaveClass('text-xs px-2 py-1 rounded');
            expect(dismissButton).toHaveClass('bg-yellow-500/30');
            expect(dismissButton).toHaveClass('hover:bg-yellow-500/50');
        });
    });

    describe('Accessibility', () => {
        it('should render as a section with proper structure', () => {
            const { container } = render(
                <CompressionWarning tier="minimal" onDismiss={vi.fn()} />
            );

            expect(container.firstChild).toBeInTheDocument();
            expect(container.firstChild?.firstChild).toHaveClass('flex items-center gap-2');
        });
    });
});
