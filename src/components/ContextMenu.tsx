import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ContextMenuProps {
    show: boolean;
    x: number;
    y: number;
    onClose: () => void;
    children: React.ReactNode;
}

/**
 * ContextMenu component that renders outside the scaled container using React Portal.
 * This ensures the menu is positioned relative to the viewport, not the transformed parent.
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ show, x, y, onClose, children }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (show) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [show, onClose]);

    // Close menu on ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && show) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [show, onClose]);

    if (!show) return null;

    // Render the menu using React Portal to document.body
    // This ensures it's outside the scaled container and positioned relative to viewport
    return createPortal(
        <div
            ref={menuRef}
            className="fixed w-36 bg-gx-gray border border-gx-accent/20 rounded shadow-xl z-[10000] p-1 flex flex-col gap-1"
            style={{ left: x, top: y }}
        >
            {children}
        </div>,
        document.body
    );
};
