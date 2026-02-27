import React, { useState } from 'react';
import { cn } from '../../utils/cn';

const PRESET_COLORS = [
    { name: 'Purple', color: '#7f22fe' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Cyan', color: '#00d4ff' },
    { name: 'Teal', color: '#14b8a6' },
    { name: 'Green', color: '#00ff88' },
    { name: 'Lime', color: '#84cc16' },
    { name: 'Yellow', color: '#eab308' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Red', color: '#ff1b1b' },
    { name: 'Pink', color: '#ec4899' },
    { name: 'Rose', color: '#f43f5e' },
    { name: 'Indigo', color: '#6366f1' },
];

const isPresetColor = (color: string): boolean => {
    return PRESET_COLORS.some(p => p.color.toLowerCase() === color.toLowerCase());
};

interface ColorPaletteProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ value, onChange, label }) => {
    const [customColor, setCustomColor] = useState(value && !isPresetColor(value) ? value : '#7f22fe');

    const handlePresetClick = (color: string) => {
        onChange(color);
    };

    const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setCustomColor(newColor);
        onChange(newColor);
    };

    const handleCustomPickerClick = () => {
        if (!isPresetColor(value)) {
            onChange(customColor);
        }
    };

    const isPresetSelected = isPresetColor(value);
    const isCustomSelected = value && !isPresetSelected;

    return (
        <div className="space-y-3">
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">{label}</span>
            <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((preset) => {
                    const isSelected = value?.toLowerCase() === preset.color.toLowerCase();
                    return (
                        <button
                            type="button"
                            key={preset.color}
                            onClick={() => handlePresetClick(preset.color)}
                            aria-label={preset.name}
                            aria-pressed={isSelected}
                            className={cn(
                                "w-full aspect-square rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg",
                                isSelected
                                    ? "border-white ring-2 ring-white/30"
                                    : "border-transparent hover:border-white/20"
                            )}
                            style={{ background: preset.color }}
                            title={preset.name}
                        />
                    );
                })}
            </div>
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="color"
                        value={isCustomSelected ? value : customColor}
                        onChange={handleCustomColorChange}
                        onClick={handleCustomPickerClick}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                        style={{ padding: 0 }}
                    />
                    <span className="text-xs text-gx-muted">Custom</span>
                </label>
                {isCustomSelected && (
                    <span className="text-xs font-mono text-gx-accent">{value}</span>
                )}
            </div>
        </div>
    );
};
