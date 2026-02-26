import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { DROPDOWN_MAX_HEIGHT } from '../../constants';

interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ElementType;
}

interface DropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: DropdownOption[];
    label: string;
    disabled?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({ value, onChange, options, label, disabled = false }) => {
    const id = useId();
    const labelId = `${id}-label`;
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            setPortalRoot(document.body);
        }
    }, []);

    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuHeight = menuRef.current?.offsetHeight || DROPDOWN_MAX_HEIGHT;

            let top: number;
            if (spaceBelow >= menuHeight + 4 || spaceBelow >= spaceAbove) {
                top = rect.bottom + 4;
            } else {
                top = rect.top - menuHeight - 4;
            }

            setPosition({
                top,
                left: rect.left,
                width: rect.width,
            });
        }
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (disabled) return;

        switch (e.key) {
            case 'Escape':
                setIsOpen(false);
                buttonRef.current?.focus();
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                    setFocusedIndex(options.findIndex(o => o.value === value));
                } else {
                    setFocusedIndex(prev => (prev + 1) % options.length);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                    setFocusedIndex(options.findLastIndex(o => o.value === value));
                } else {
                    setFocusedIndex(prev => (prev - 1 + options.length) % options.length);
                }
                break;
            case 'Enter':
            case ' ':
                if (isOpen && focusedIndex >= 0) {
                    e.preventDefault();
                    onChange(options[focusedIndex].value);
                    setIsOpen(false);
                    buttonRef.current?.focus();
                }
                break;
        }
    }, [disabled, isOpen, focusedIndex, options, onChange, value]);

    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && menuRef.current) {
            const focusedEl = menuRef.current.children[focusedIndex] as HTMLElement;
            if (focusedEl?.scrollIntoView) {
                focusedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    useEffect(() => {
        if (isOpen) {
            const currentIndex = options.findIndex(o => o.value === value);
            setFocusedIndex(currentIndex >= 0 ? currentIndex : -1);
            updatePosition();
        }
    }, [isOpen, options, value, updatePosition]);

    useEffect(() => {
        if (isOpen) {
            updatePosition();

            const handleClickOutside = (event: MouseEvent) => {
                if (
                    dropdownRef.current &&
                    !dropdownRef.current.contains(event.target as Node) &&
                    buttonRef.current &&
                    !buttonRef.current.contains(event.target as Node)
                ) {
                    setIsOpen(false);
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen, updatePosition]);

    return (
        <div className="space-y-2">
            <span id={labelId} className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">{label}</span>
            <div className="relative">
                <button
                    type="button"
                    ref={buttonRef}
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-labelledby={labelId}
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(!isOpen);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gx-gray border border-white/5 rounded-lg hover:border-gx-accent/30 transition-all",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <div className="flex items-center gap-2">
                        {selectedOption?.icon && <selectedOption.icon size={14} className="text-gx-accent" />}
                        <span className="text-xs text-gray-200">{selectedOption?.label}</span>
                    </div>
                    <ChevronDown size={12} className={cn("text-gray-500 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && portalRoot &&
                    createPortal(
                        <div
                            ref={(el) => { dropdownRef.current = el; menuRef.current = el; }}
                            role="listbox"
                            aria-activedescendant={focusedIndex >= 0 ? `${id}-option-${options[focusedIndex]?.value}` : undefined}
                            className="fixed z-[9999] bg-gx-dark border border-gx-accent/20 rounded-lg shadow-xl"
                            style={{
                                top: position.top,
                                left: position.left,
                                width: position.width,
                                maxHeight: `${DROPDOWN_MAX_HEIGHT}px`,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                            }}
                        >
                            {options.map((option, index) => (
                                <button
                                    type="button"
                                    role="option"
                                    id={`${id}-option-${option.value}`}
                                    key={option.value}
                                    aria-selected={index === focusedIndex}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    onMouseEnter={() => setFocusedIndex(index)}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all",
                                        option.value === value
                                            ? "bg-gx-accent/10 text-gx-accent"
                                            : index === focusedIndex
                                                ? "bg-gx-accent/20 text-gray-200"
                                                : "text-gray-400 hover:bg-gx-accent/20 hover:text-gray-200"
                                    )}
                                >
                                    {option.icon && <option.icon size={14} className="opacity-80" />}
                                    <span className="text-xs">{option.label}</span>
                                </button>
                            ))}
                        </div>,
                        portalRoot
                    )}
            </div>
        </div>
    );
};
