import type {
  VaultQuotaInfo,
  QuotaWarningLevel,
  VaultMeta,
  VaultItem
} from '../types/index';
import { 
  CHROME_SYNC_QUOTA_BYTES, 
  SYNC_SETTINGS_RESERVE_BYTES, 
  QUOTA_WARNING_THRESHOLD, 
  QUOTA_CRITICAL_THRESHOLD 
} from '../constants';

const VAULT_META_KEY = 'vault_meta';
const VAULT_CHUNK_PREFIX = 'vault_chunk_';
const LEGACY_VAULT_KEY = 'vault';

function getWarningLevel(percentage: number): QuotaWarningLevel {
  if (percentage >= QUOTA_CRITICAL_THRESHOLD) return 'critical';
  if (percentage >= QUOTA_WARNING_THRESHOLD) return 'warning';
  return 'none';
}

async function getVaultChunkKeys(): Promise<string[]> {
  const metaResult = await chrome.storage.sync.get(VAULT_META_KEY);
  const meta = metaResult[VAULT_META_KEY] as VaultMeta | undefined;
  
  if (meta && Array.isArray(meta.chunkKeys)) {
    return [VAULT_META_KEY, ...meta.chunkKeys];
  }

  const allKeys = await chrome.storage.sync.get(null);
  return Object.keys(allKeys).filter(
    key => key === VAULT_META_KEY || key.startsWith(VAULT_CHUNK_PREFIX)
  );
}

export const quotaService = {
  getVaultQuota: async (): Promise<VaultQuotaInfo> => {
    const settingsKeys = ['appearanceSettings', 'dividerPosition', 'showVault', 'vaultSyncEnabled', 'settingsPanelWidth'];
    const [settingsBytes, vaultKeys] = await Promise.all([
      chrome.storage.sync.getBytesInUse(settingsKeys),
      getVaultChunkKeys()
    ]);
    
    const vaultBytes = vaultKeys.length > 0 
      ? await chrome.storage.sync.getBytesInUse(vaultKeys)
      : 0;
    
    const settingsTotal = Math.max(settingsBytes, SYNC_SETTINGS_RESERVE_BYTES);
    const available = CHROME_SYNC_QUOTA_BYTES - settingsTotal;
    const percentage = available > 0 ? vaultBytes / available : 1;
    
    return {
      used: vaultBytes,
      available: available - vaultBytes,
      total: available,
      percentage,
      warningLevel: getWarningLevel(percentage)
    };
  },

  getStorageStats: async (): Promise<{
    syncUsed: number;
    syncTotal: number;
    localUsed: number;
    vaultItemCount: number;
  }> => {
    const [syncBytes, localBytes, localData] = await Promise.all([
      chrome.storage.sync.getBytesInUse(null),
      chrome.storage.local.getBytesInUse(null),
      chrome.storage.local.get([LEGACY_VAULT_KEY, 'vault_backup'])
    ]);
    
    const vault = (localData[LEGACY_VAULT_KEY] || localData.vault_backup || []) as VaultItem[];
    
    return {
      syncUsed: syncBytes,
      syncTotal: CHROME_SYNC_QUOTA_BYTES,
      localUsed: localBytes,
      vaultItemCount: vault.length
    };
  }
};
