import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { QuotaExceededModal, type QuotaExceededAction } from '../QuotaExceededModal';

describe('QuotaExceededModal', () => {
    describe('Rendering', () => {
        it('should not render when isOpen is false', () => {
            const { container } = render(
                <QuotaExceededModal
                    isOpen={false}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );
            expect(container.firstChild).toBeNull();
        });

        it('should render when isOpen is true', () => {
            const { container } = render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );
            expect(container.firstChild).toBeInTheDocument();
        });

        it('should render modal title', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            expect(screen.getByText('Sync Storage Full')).toBeInTheDocument();
        });

        it('should render all three action buttons', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            expect(screen.getByText('Switch to Local Storage')).toBeInTheDocument();
            expect(screen.getByText('Free Up Space')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });
    });

    describe('Byte Formatting', () => {
        it('should format bytes under 1KB correctly', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={500}
                    bytesAvailable={-100}
                    onAction={vi.fn()}
                />
            );

            expect(screen.getByText(/500 B/)).toBeInTheDocument();
        });

        it('should format bytes over 1KB correctly', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            expect(screen.getByText(/48.8 KB/)).toBeInTheDocument();
        });

        it('should format bytes in the description correctly', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={2048}
                    bytesAvailable={-512}
                    onAction={vi.fn()}
                />
            );

            // Should show "Using 2.0 KB, need 512 B more"
            expect(screen.getByText(/Using 2\.0 KB/)).toBeInTheDocument();
        });
    });

    describe('Actions', () => {
        it('should call onAction with switch-local on button click', async () => {
            const onAction = vi.fn();
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={onAction}
                />
            );

            await userEvent.click(screen.getByText('Switch to Local Storage'));
            expect(onAction).toHaveBeenCalledWith('switch-local');
        });

        it('should call onAction with free-space on button click', async () => {
            const onAction = vi.fn();
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={onAction}
                />
            );

            await userEvent.click(screen.getByText('Free Up Space'));
            expect(onAction).toHaveBeenCalledWith('free-space');
        });

        it('should call onAction with cancel on button click', async () => {
            const onAction = vi.fn();
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={onAction}
                />
            );

            await userEvent.click(screen.getByText('Cancel'));
            expect(onAction).toHaveBeenCalledWith('cancel');
        });
    });

    describe('Styling', () => {
        it('should have correct modal backdrop styling', () => {
            const { container } = render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            const backdrop = container.firstChild as HTMLElement;
            expect(backdrop).toHaveClass('fixed inset-0 z-50');
            expect(backdrop).toHaveClass('flex items-center justify-center');
        });

        it('should have correct modal content styling', () => {
            const { container } = render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            const modal = container.firstChild?.firstChild as HTMLElement;
            expect(modal).toHaveClass('bg-gx-gray');
            expect(modal).toHaveClass('rounded-lg');
        });

        it('should have correct button styling for Cancel', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            const button = screen.getByText('Cancel');
            expect(button).toHaveClass('w-full p-3 rounded-lg text-center');
            expect(button).toHaveClass('text-gray-400 hover:text-gx-text');
        });
    });

    describe('Accessibility', () => {
        it('should render description text', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            expect(screen.getByText(/Your vault has exceeded the sync storage quota/i)).toBeInTheDocument();
        });

        it('should render action descriptions', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={50000}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            expect(screen.getByText(/Unlimited space, but won't sync across devices/)).toBeInTheDocument();
            expect(screen.getByText(/Remove old items from your vault/)).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero bytes used', () => {
            render(
                <QuotaExceededModal
                    isOpen={true}
                    bytesUsed={0}
                    bytesAvailable={-1000}
                    onAction={vi.fn()}
                />
            );

            expect(screen.getByText(/0 B/)).toBeInTheDocument();
        });
    });
});
