import React from 'react';
import { cn } from '../../utils/cn';
import {
    GX_ACCENT_COLOR,
    GX_RED_COLOR,
    GX_CYAN_COLOR,
    GX_GREEN_COLOR
} from '../../constants';

const colors = [
    { name: 'GX Accent', value: 'gx-accent', color: GX_ACCENT_COLOR },
    { name: 'GX Red', value: 'gx-red', color: GX_RED_COLOR },
    { name: 'GX Cyan', value: 'gx-cyan', color: GX_CYAN_COLOR },
    { name: 'GX Green', value: 'gx-green', color: GX_GREEN_COLOR },
    { name: 'Custom', value: 'custom', color: `linear-gradient(135deg, ${GX_ACCENT_COLOR} 0%, ${GX_RED_COLOR} 100%)` },
];

interface ColorPaletteProps {
    value: string;
    onChange: (value: string) => void;
    label: string;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ value, onChange, label }) => {
    return (
        <div className="space-y-2">
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">{label}</span>
            <div className="grid grid-cols-5 gap-2">
                {colors.map((color) => (
                    <button
                        type="button"
                        key={color.value}
                        onClick={() => onChange(color.value)}
                        aria-label={color.name}
                        aria-pressed={value === color.value}
                        className={cn(
                            "w-full aspect-square rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg",
                            value === color.value
                                ? "border-gx-accent ring-2 ring-gx-accent/50"
                                : "border-transparent hover:border-white/20"
                        )}
                        style={{ background: color.color }}
                        title={color.name}
                    />
                ))}
            </div>
        </div>
    );
};
