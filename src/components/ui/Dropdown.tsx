import React, { useState, useEffect, useRef, useCallback } from 'react';
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
}

export const Dropdown: React.FC<DropdownProps> = ({ value, onChange, options, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
            });
        }
    }, []);

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

            const handleScroll = () => {
                updatePosition();
            };

            const handleResize = () => {
                updatePosition();
            };

            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);

            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [isOpen, updatePosition]);

    return (
        <div className="space-y-2">
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">{label}</span>
            <div className="relative">
                <button
                    ref={buttonRef}
                    onClick={() => {
                        if (!isOpen) {
                            updatePosition();
                        }
                        setIsOpen(!isOpen);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gx-gray border border-white/5 rounded-lg hover:border-gx-accent/30 transition-all"
                >
                    <div className="flex items-center gap-2">
                        {selectedOption?.icon && <selectedOption.icon size={14} className="text-gx-accent" />}
                        <span className="text-xs text-gray-200">{selectedOption?.label}</span>
                    </div>
                    <ChevronDown size={12} className={cn("text-gray-500 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen &&
                    createPortal(
                        <div
                            ref={dropdownRef}
                            className="fixed z-[9999] bg-gx-dark border border-gx-accent/20 rounded-lg shadow-xl overflow-hidden"
                            style={{
                                top: position.top,
                                left: position.left,
                                width: position.width,
                                maxHeight: `${DROPDOWN_MAX_HEIGHT}px`,
                                overflowY: 'auto',
                            }}
                        >
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all",
                                        option.value === value
                                            ? "bg-gx-accent/10 text-gx-accent"
                                            : "text-gray-400 hover:bg-gx-accent/20 hover:text-gray-200"
                                    )}
                                >
                                    {option.icon && <option.icon size={14} className="opacity-80" />}
                                    <span className="text-xs">{option.label}</span>
                                </button>
                            ))}
                        </div>,
                        document.body
                    )}
            </div>
        </div>
    );
};
