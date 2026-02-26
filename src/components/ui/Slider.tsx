import React, { useId } from 'react';

interface SliderProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    label: string;
    displayValue?: string;
}

export const Slider: React.FC<SliderProps> = ({ value, onChange, min, max, step, label, displayValue }) => {
    const id = useId();
    const percentage = max === min ? 0 : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label id={`${id}-label`} className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</label>
                {displayValue && (
                    <span className="text-xs font-mono text-gx-accent bg-gx-accent/10 px-2 py-0.5 rounded">
                        {displayValue}
                    </span>
                )}
            </div>
            <div className="relative h-3 bg-gx-gray/50 rounded-full">
                <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div
                        className="absolute h-full bg-gradient-to-r from-gx-accent to-gx-red transition-all duration-150"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    aria-labelledby={`${id}-label`}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
                />
                {/* Visible thumb */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border border-white/20 z-20 pointer-events-none transition-all duration-150"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                />
            </div>
        </div>
    );
};
