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
import { VAULT_META_KEY, VAULT_CHUNK_PREFIX, LEGACY_VAULT_KEY, getVaultChunkKeys } from './storageKeys';
import { logger } from '../utils/logger';

export type StorageHealthStatus = 'healthy' | 'degraded' | 'critical';

function getWarningLevel(percentage: number): QuotaWarningLevel {
  if (percentage >= QUOTA_CRITICAL_THRESHOLD) return 'critical';
  if (percentage >= QUOTA_WARNING_THRESHOLD) return 'warning';
  return 'none';
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
    const orphanedCount = await countOrphanedChunks();

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
      warningLevel: getWarningLevel(percentage),
      orphanedChunks: orphanedCount
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
      const [syncBytesInUse, localBytesInUse, syncMeta, localData] = await Promise.all([
        chrome.storage.sync.getBytesInUse(null),
        chrome.storage.local.getBytesInUse(null),
        chrome.storage.sync.get(VAULT_META_KEY),
        chrome.storage.local.get([LEGACY_VAULT_KEY, 'vault_backup'])
      ]);

      const syncAllData = await chrome.storage.sync.get(null);
      const meta = syncMeta[VAULT_META_KEY] as VaultMeta | undefined;
      const validKeys = new Set([VAULT_META_KEY, ...(meta?.chunkKeys || [])]);
      const orphanedChunks = Object.keys(syncAllData).filter(
        key => key.startsWith(VAULT_CHUNK_PREFIX) && !validKeys.has(key)
      ).length;

      const syncUsageRatio = syncBytesInUse / CHROME_SYNC_QUOTA_BYTES;
      let health: StorageHealthStatus = 'healthy';
      if (syncUsageRatio > 0.95 || orphanedChunks > 5) {
        health = 'critical';
      } else if (syncUsageRatio > 0.85 || orphanedChunks > 0) {
        health = 'degraded';
      }

      const vault = (localData[LEGACY_VAULT_KEY] || localData.vault_backup || []) as VaultItem[];

      return {
        health,
        syncUsed: syncBytesInUse,
        syncTotal: CHROME_SYNC_QUOTA_BYTES,
        localUsed: localBytesInUse,
        vaultItemCount: vault.length,
        orphanedChunks,
        lastSyncTime: meta?.timestamp || null
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
  },

  logQuotaDetails: async (): Promise<VaultQuotaInfo> => {
    const quota = await quotaService.getVaultQuota();
    logger.info('[QuotaService] 📊 Detailed quota status:');
    logger.info(`[QuotaService]   - Settings reserve: ${SYNC_SETTINGS_RESERVE_BYTES} bytes`);
    logger.info(`[QuotaService]   - Total sync quota: ${CHROME_SYNC_QUOTA_BYTES} bytes`);
    logger.info(`[QuotaService]   - Available for vault (capacity): ${quota.total} bytes`);
    logger.info(`[QuotaService]   - Currently used by vault: ${quota.used} bytes`);
    logger.info(`[QuotaService]   - Free space: ${quota.available} bytes`);
    logger.info(`[QuotaService]   - Usage percentage: ${Math.round(quota.percentage * 100)}%`);
    logger.info(`[QuotaService]   - Warning level: ${quota.warningLevel}`);
    return quota;
  }
};
