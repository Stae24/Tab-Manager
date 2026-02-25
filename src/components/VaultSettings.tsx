import React from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Toggle } from './ui/Toggle';
import { cn } from '../utils/cn';
import type { AppearanceSettings } from '../types';

interface VaultSettingsProps {
    appearanceSettings: AppearanceSettings;
    setVaultSyncEnabled: (enabled: boolean) => Promise<any>;
    vaultQuota: {
        used: number;
        total: number;
        percentage: number;
        warningLevel: 'none' | 'warning' | 'critical';
    } | null;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
}

export const VaultSettings: React.FC<VaultSettingsProps> = ({
    appearanceSettings,
    setVaultSyncEnabled,
    vaultQuota,
    expandedSections,
    toggleSection
}) => {
    return (
        <>
            <CollapsibleSection
                id="vault-sync"
                title="Cloud Sync"
                icon={Cloud}
                isExpanded={expandedSections.has('vault-sync')}
                onToggle={() => toggleSection('vault-sync')}
            >
                <div className="space-y-4">
                    <Toggle
                        checked={appearanceSettings.vaultSyncEnabled}
                        onChange={async (checked) => {
                            await setVaultSyncEnabled(checked);
                        }}
                        label="Sync Vault Across Devices"
                        description={
                            appearanceSettings.vaultSyncEnabled
                                ? "Vault syncs via Chrome/Opera account (100KB limit)"
                                : "Vault stored locally only (unlimited space)"
                        }
                    />

                    {vaultQuota && (
                        <div className="bg-gx-gray/50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-400 flex items-center gap-2">
                                    {appearanceSettings.vaultSyncEnabled ? (
                                        <Cloud size={12} className="text-gx-accent" />
                                    ) : (
                                        <HardDrive size={12} className="text-gray-500" />
                                    )}
                                    Storage Used
                                </span>
                                <span className={cn(
                                    "font-mono",
                                    vaultQuota.warningLevel === 'critical' ? "text-gx-red" :
                                        vaultQuota.warningLevel === 'warning' ? "text-yellow-400" :
                                            "text-gray-300"
                                )}>
                                    {(vaultQuota.used / 1024).toFixed(1)} KB / {(vaultQuota.total / 1024).toFixed(0)} KB
                                </span>
                            </div>
                            <div className="relative h-2 bg-gx-dark rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "absolute h-full transition-all duration-300",
                                        vaultQuota.warningLevel === 'critical' ? "bg-gx-red" :
                                            vaultQuota.warningLevel === 'warning' ? "bg-yellow-500" :
                                                "bg-gx-accent"
                                    )}
                                    style={{ width: `${Math.min(vaultQuota.percentage * 100, 100)}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-gray-500">
                                {Math.round(vaultQuota.percentage * 100)}% used
                                {vaultQuota.warningLevel !== 'none' && (
                                    <span className={cn(
                                        "ml-2 font-bold uppercase",
                                        vaultQuota.warningLevel === 'critical' ? "text-gx-red" : "text-yellow-400"
                                    )}>
                                        {vaultQuota.warningLevel === 'critical' ? 'Critical' : 'Warning'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CollapsibleSection>
        </>
    );
};
