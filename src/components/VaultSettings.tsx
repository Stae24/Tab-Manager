import React from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { Toggle } from './ui/Toggle';
import { cn } from '../utils/cn';
import type { AppearanceSettings, VaultStorageResult, VaultQuotaInfo, QuotaWarningLevel } from '../types';
import { CHROME_SYNC_QUOTA_BYTES } from '../constants';

function warningColor(warningLevel: QuotaWarningLevel, kind: 'text' | 'bg'): string {
    if (warningLevel === 'critical') {
        return kind === 'text' ? 'text-gx-red' : 'bg-gx-red';
    }
    if (warningLevel === 'warning') {
        return kind === 'text' ? 'text-yellow-400' : 'bg-yellow-500';
    }
    return kind === 'text' ? 'text-gray-300' : 'bg-gx-accent';
}

interface VaultSettingsProps {
    appearanceSettings: AppearanceSettings;
    setAppearanceSettings: (settings: Partial<AppearanceSettings>) => void;
    setVaultSyncEnabled: (enabled: boolean) => Promise<VaultStorageResult>;
    vaultQuota: VaultQuotaInfo | null;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
}

export const VaultSettings: React.FC<VaultSettingsProps> = ({
    appearanceSettings,
    setAppearanceSettings,
    setVaultSyncEnabled,
    vaultQuota,
    expandedSections,
    toggleSection
}) => {
    const syncLimitKB = vaultQuota ? Math.round(vaultQuota.total / 1024) : Math.round(CHROME_SYNC_QUOTA_BYTES / 1024);

    return (
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
                        const previousValue = appearanceSettings.vaultSyncEnabled;
                        try {
                            await setVaultSyncEnabled(checked);
                        } catch (error) {
                            console.error('Failed to toggle vault sync:', error);
                            setAppearanceSettings({ vaultSyncEnabled: previousValue });
                        }
                    }}
                    label="Sync Vault Across Devices"
                    description={
                        appearanceSettings.vaultSyncEnabled
                            ? `Vault syncs via Chrome/Opera account (${syncLimitKB}KB limit)`
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
                                warningColor(vaultQuota.warningLevel, 'text')
                            )}>
                                {(vaultQuota.used / 1024).toFixed(1)} KB / {(vaultQuota.total / 1024).toFixed(0)} KB
                            </span>
                        </div>
                        <div className="relative h-2 bg-gx-dark rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "absolute h-full transition-all duration-300",
                                    warningColor(vaultQuota.warningLevel, 'bg')
                                )}
                                style={{ width: `${Math.min(vaultQuota.percentage, 100)}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-gray-500">
                            {Math.round(vaultQuota.percentage)}% used
                            {vaultQuota.warningLevel !== 'none' && (
                                <span className={cn(
                                    "ml-2 font-bold uppercase",
                                    warningColor(vaultQuota.warningLevel, 'text')
                                )}>
                                    {vaultQuota.warningLevel === 'critical' ? 'Critical' : 'Warning'}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </CollapsibleSection>
    );
};
