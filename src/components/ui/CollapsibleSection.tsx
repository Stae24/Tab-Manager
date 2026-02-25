import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CollapsibleSectionProps {
    id: string;
    title: string;
    icon: React.ElementType;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    icon: Icon,
    isExpanded,
    onToggle,
    children
}) => {
    return (
        <div className="border border-white/5 rounded-lg overflow-hidden bg-gx-gray/30">
            <button
                onClick={() => onToggle()}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all"
            >
                <Icon size={16} className="text-gx-accent" />
                <span className="flex-1 text-left text-sm font-bold text-gray-200">{title}</span>
                <div className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
                    <ChevronDown size={14} className="text-gray-500" />
                </div>
            </button>
            {isExpanded && (
                <div className="px-4 pb-4 space-y-3 pt-2">
                    {children}
                </div>
            )}
        </div>
    );
};
