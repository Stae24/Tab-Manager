import React from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CollapsibleSectionProps {
    id: string;
    title: string;
    icon: LucideIcon;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    id,
    title,
    icon: Icon,
    isExpanded,
    onToggle,
    children
}) => {
    return (
        <div className="shrink-0 border border-gx-border rounded-lg overflow-hidden bg-gx-gray/30">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                aria-controls={`${id}-content`}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gx-hover transition-all"
            >
                <Icon size={16} className="text-gx-accent" />
                <span className="flex-1 text-left text-sm font-bold text-gx-text">{title}</span>
                <div className={cn("transition-transform duration-300", isExpanded && "rotate-180")}>
                    <ChevronDown size={14} className="text-gx-muted" />
                </div>
            </button>
            {isExpanded && (
                <div id={`${id}-content`} className="px-4 pb-4 space-y-3 pt-2">
                    {children}
                </div>
            )}
        </div>
    );
};
