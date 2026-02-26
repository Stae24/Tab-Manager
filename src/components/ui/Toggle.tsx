import React from 'react';
import { cn } from '../../utils/cn';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label || 'Toggle'}
            onClick={() => onChange(!checked)}
            className={cn(
                "flex items-center gap-3 w-full p-3 rounded-lg transition-all border",
                checked
                    ? "bg-gx-accent/10 border-gx-accent/30"
                    : "bg-gx-gray border-white/5 hover:border-gx-accent/20"
            )}
        >
            <div
                className={cn(
                    "w-11 h-6 rounded-full p-1 transition-all duration-300",
                    checked ? "bg-gx-accent" : "bg-gx-gray"
                )}
            >
                <div className={cn(
                    "w-4 h-4 rounded-full shadow-lg transform transition-transform duration-300",
                    checked ? "bg-white shadow-gx-accent/50 translate-x-5" : "bg-gray-400 translate-x-0"
                )} />
            </div>
            {(label || description) && (
                <div className="flex-1 text-left">
                    {label && (
                        <span className={cn(
                            "text-xs font-bold block",
                            checked ? "text-gx-accent" : "text-gray-300"
                        )}>
                            {label}
                        </span>
                    )}
                    {description && (
                        <span className="text-[10px] text-gray-500 block mt-0.5">
                            {description}
                        </span>
                    )}
                </div>
            )}
        </button>
    );
};
