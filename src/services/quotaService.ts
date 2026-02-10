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
import { logger } from '../utils/logger';

const VAULT_META_KEY = 'vault_meta';
const VAULT_CHUNK_PREFIX = 'vault_chunk_';
const LEGACY_VAULT_KEY = 'vault';

export type StorageHealthStatus = 'healthy' | 'degraded' | 'critical';

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

async function countOrphanedChunks(): Promise<number> {
  try {
    const metaResult = await chrome.storage.sync.get(VAULT_META_KEY);
    const meta = metaResult[VAULT_META_KEY] as VaultMeta | undefined;
    
    if (!meta || !Array.isArray(meta.chunkKeys)) {
      return 0;
    }
    
    const allData = await chrome.storage.sync.get(null);
    const validKeys = new Set([VAULT_META_KEY, ...meta.chunkKeys]);
    
    const orphaned = Object.keys(allData).filter(
      key => key.startsWith(VAULT_CHUNK_PREFIX) && !validKeys.has(key)
    );
    
    return orphaned.length;
  } catch {
    return 0;
  }
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
  },

  cleanupOrphanedChunks: async (): Promise<number> => {
    try {
      const metaResult = await chrome.storage.sync.get(VAULT_META_KEY);
      const meta = metaResult[VAULT_META_KEY] as VaultMeta | undefined;
      
      if (!meta || !Array.isArray(meta.chunkKeys)) {
        logger.warn('[QuotaService] No meta found, skipping cleanup');
        return 0;
      }
      
      const allData = await chrome.storage.sync.get(null);
      const validKeys = new Set([VAULT_META_KEY, ...meta.chunkKeys]);
      
      const orphaned = Object.keys(allData).filter(
        key => key.startsWith(VAULT_CHUNK_PREFIX) && !validKeys.has(key)
      );
      
      if (orphaned.length > 0) {
        logger.info(`[QuotaService] Removing ${orphaned.length} orphaned chunks`);
        await chrome.storage.sync.remove(orphaned);
      }
      
      return orphaned.length;
    } catch (error) {
      logger.error('[QuotaService] Cleanup failed:', error);
      return 0;
    }
  },

  getStorageHealth: async (): Promise<StorageHealthStatus> => {
    try {
      const [syncStats, orphanedCount] = await Promise.all([
        chrome.storage.sync.getBytesInUse(null),
        countOrphanedChunks()
      ]);
      
      const syncUsageRatio = syncStats / CHROME_SYNC_QUOTA_BYTES;
      
      if (syncUsageRatio > 0.95) return 'critical';
      if (syncUsageRatio > 0.85) return 'degraded';
      if (orphanedCount > 5) return 'degraded';
      
      return 'healthy';
    } catch {
      return 'degraded';
    }
  },

  getStorageReport: async (): Promise<{
    health: StorageHealthStatus;
    syncUsed: number;
    syncTotal: number;
    localUsed: number;
    vaultItemCount: number;
    orphanedChunks: number;
    lastSyncTime: number | null;
  }> => {
    try {
      const [health, stats, meta, orphanedCount] = await Promise.all([
        quotaService.getStorageHealth(),
        quotaService.getStorageStats(),
        chrome.storage.sync.get(VAULT_META_KEY),
        countOrphanedChunks()
      ]);
      
      return {
        health,
        syncUsed: stats.syncUsed,
        syncTotal: stats.syncTotal,
        localUsed: stats.localUsed,
        vaultItemCount: stats.vaultItemCount,
        orphanedChunks: orphanedCount,
        lastSyncTime: ((meta as Record<string, unknown>)?.[VAULT_META_KEY] as VaultMeta | undefined)?.timestamp || null
      };
    } catch (error) {
      logger.error('[QuotaService] Failed to generate storage report:', error);
      return {
        health: 'degraded',
        syncUsed: 0,
        syncTotal: CHROME_SYNC_QUOTA_BYTES,
        localUsed: 0,
        vaultItemCount: 0,
        orphanedChunks: 0,
        lastSyncTime: null
      };
    }
  }
};
