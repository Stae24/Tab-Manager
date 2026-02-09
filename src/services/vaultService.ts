import LZString from 'lz-string';
import type {
  VaultItem,
  VaultStorageConfig,
  VaultStorageResult,
  VaultMeta,
  MigrationResult,
  VaultLoadResult
} from '../types/index';
import { quotaService } from './quotaService';
import { STORAGE_VERSION, VAULT_CHUNK_SIZE } from '../constants';
import { logger } from '../utils/logger';

const VAULT_META_KEY = 'vault_meta';
const VAULT_CHUNK_PREFIX = 'vault_chunk_';
const LEGACY_VAULT_KEY = 'vault';

async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

async function loadFromBackup(): Promise<VaultItem[]> {
  logger.warn('[VaultStorage] Attempting to load from local backup');
  const local = await chrome.storage.local.get(['vault_backup']);
  return (local.vault_backup as VaultItem[]) || [];
}

export const vaultService = {
  loadVault: async (config: VaultStorageConfig): Promise<VaultLoadResult> => {
    if (!config.syncEnabled) {
      const local = await chrome.storage.local.get([LEGACY_VAULT_KEY]);
      return {
        vault: (local[LEGACY_VAULT_KEY] as VaultItem[]) || [],
        timestamp: 0 
      };
    }
    
    try {
      logger.info('[VaultStorage] Loading vault from sync storage...');
      
      // First, get just the meta to determine which chunks we need
      const metaResult = await chrome.storage.sync.get(VAULT_META_KEY);
      const meta = metaResult[VAULT_META_KEY] as VaultMeta | undefined;
      
      if (!meta) {
        logger.warn('[VaultStorage] No meta found, loading from backup');
        return { vault: await loadFromBackup(), timestamp: 0 };
      }
      
      logger.info(`[VaultStorage] Found meta: version=${meta.version}, chunkCount=${meta.chunkCount}, chunkKeys=${meta.chunkKeys?.length || 'undefined'}`);
      
      if (meta.version !== STORAGE_VERSION) {
        logger.warn(`[VaultStorage] Version mismatch: expected ${STORAGE_VERSION}, got ${meta.version}. Attempting to load data anyway.`);
      }
      
      const chunks: string[] = [];
      const chunkKeys = meta.chunkKeys || Array.from({ length: meta.chunkCount }, (_, i) => `${VAULT_CHUNK_PREFIX}${i}`);
      
      logger.info(`[VaultStorage] Loading ${chunkKeys.length} chunks: ${chunkKeys.join(', ')}`);
      
      // Explicitly request specific keys instead of get(null) to avoid pagination/limit issues
      const keysToFetch = [VAULT_META_KEY, ...chunkKeys];
      const syncData = await chrome.storage.sync.get(keysToFetch);
      
      logger.info(`[VaultStorage] Retrieved ${Object.keys(syncData).length} items from storage`);
      
      for (let i = 0; i < chunkKeys.length; i++) {
        const chunk = syncData[chunkKeys[i]] as string | undefined;
        const chunkSize = chunk ? chunk.length * 2 : 0; // UTF-16 = 2 bytes per char
        logger.info(`[VaultStorage] Chunk ${chunkKeys[i]}: ${chunk ? 'FOUND' : 'MISSING'}, size=${chunkSize} bytes`);
        
        if (chunk === undefined) {
          logger.error(`[VaultStorage] Missing chunk ${chunkKeys[i]}, loading from backup`);
          return { vault: await loadFromBackup(), timestamp: meta.timestamp };
        }
        chunks.push(chunk);
      }
      
      const totalCompressedSize = chunks.reduce((sum, chunk) => sum + chunk.length * 2, 0);
      logger.info(`[VaultStorage] All chunks loaded. Total compressed size: ${totalCompressedSize} bytes`);

      const compressed = chunks.join('');
      const jsonData = LZString.decompressFromUTF16(compressed);

      if (!jsonData) {
        logger.error('[VaultStorage] Decompression failed, loading from backup');
        return { vault: await loadFromBackup(), timestamp: meta.timestamp };
      }

      const computedChecksum = await computeChecksum(jsonData);
      if (computedChecksum !== meta.checksum) {
        logger.error('[VaultStorage] Checksum mismatch, data may be corrupted - loading from backup');
        return { vault: await loadFromBackup(), timestamp: meta.timestamp };
      }
      
      let parsed: VaultItem[];
      try {
        parsed = JSON.parse(jsonData) as VaultItem[];
        if (!Array.isArray(parsed)) {
          logger.error('[VaultStorage] Parsed data is not an array, loading from backup');
          return { vault: await loadFromBackup(), timestamp: meta.timestamp };
        }
      } catch (parseError) {
        logger.error('[VaultStorage] JSON parse failed, loading from backup:', parseError);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp };
      }

      return {
        vault: parsed,
        timestamp: meta.timestamp
      };
    } catch (error) {
      logger.error('[VaultStorage] Failed to load, using backup:', error);
      return { vault: await loadFromBackup(), timestamp: 0 };
    }
  },

  saveVault: async (
    vault: VaultItem[],
    config: VaultStorageConfig
  ): Promise<VaultStorageResult> => {
    const jsonData = JSON.stringify(vault);
    const checksum = await computeChecksum(jsonData);
    
    if (!config.syncEnabled) {
      await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault });
      await chrome.storage.local.set({ vault_backup: vault });
      return { success: true };
    }
    
    const compressed = LZString.compressToUTF16(jsonData);
    const compressedBytes = compressed.length * 2;
    
    logger.info(`[VaultStorage] Preparing to save vault: ${vault.length} items, ${jsonData.length} bytes JSON, ${compressedBytes} bytes compressed`);
    
    const quota = await quotaService.getVaultQuota();
    const currentKeys = await getVaultChunkKeys();
    const currentVaultBytes = await chrome.storage.sync.getBytesInUse(currentKeys);
    const netNewBytes = compressedBytes - currentVaultBytes;
    
    logger.info(`[VaultStorage] Quota check: available=${quota.available}, needed=${netNewBytes}, currentKeys=${currentKeys.length}`);
    
    if (netNewBytes > quota.available) {
      logger.error(`[VaultStorage] Quota exceeded: need ${netNewBytes}, have ${quota.available}`);
      return {
        success: false,
        error: 'QUOTA_EXCEEDED',
        bytesUsed: quota.used,
        bytesAvailable: quota.available,
        warningLevel: 'critical'
      };
    }
    
    const chunks: string[] = [];
    const chunkKeys: string[] = [];
    for (let i = 0, idx = 0; i < compressed.length; i += VAULT_CHUNK_SIZE / 2, idx++) {
      const chunk = compressed.slice(i, i + VAULT_CHUNK_SIZE / 2);
      chunks.push(chunk);
      chunkKeys.push(`${VAULT_CHUNK_PREFIX}${idx}`);
      logger.info(`[VaultStorage] Chunk ${idx}: ${chunk.length * 2} bytes (chars: ${chunk.length})`);
    }
    
    logger.info(`[VaultStorage] Created ${chunks.length} chunks total`);
    
    const meta: VaultMeta = {
      version: STORAGE_VERSION,
      chunkCount: chunks.length,
      chunkKeys,
      checksum,
      timestamp: Date.now(),
      compressed: true
    };
    
    try {
      const storageData: Record<string, unknown> = {
        [VAULT_META_KEY]: meta
      };
      
      chunks.forEach((chunk, index) => {
        storageData[chunkKeys[index]] = chunk;
      });
      
      logger.info(`[VaultStorage] Saving ${Object.keys(storageData).length} items to sync storage...`);
      await chrome.storage.sync.set(storageData);
      logger.info('[VaultStorage] Save completed, verifying...');
      
      // Verification: Read back all saved data and verify checksum
      const verifyKeys = [VAULT_META_KEY, ...chunkKeys];
      const verifyData = await chrome.storage.sync.get(verifyKeys);
      logger.info(`[VaultStorage] Verification: retrieved ${Object.keys(verifyData).length}/${verifyKeys.length} items`);
      
      const verifyMeta = verifyData[VAULT_META_KEY] as VaultMeta | undefined;
      if (!verifyMeta) {
        logger.error('[VaultStorage] Verification FAILED: Meta missing after save');
        throw new Error('Meta missing after save');
      }
      
      const verifyChunks: string[] = [];
      for (const key of chunkKeys) {
        const chunk = verifyData[key] as string | undefined;
        if (chunk === undefined) {
          logger.error(`[VaultStorage] Verification FAILED: Chunk ${key} missing after save`);
          throw new Error(`Chunk ${key} missing after save`);
        }
        verifyChunks.push(chunk);
      }
      
      const verifyCompressed = verifyChunks.join('');
      const verifyJson = LZString.decompressFromUTF16(verifyCompressed);
      
      if (!verifyJson) {
        logger.error('[VaultStorage] Verification FAILED: Could not decompress verified data');
        throw new Error('Decompression failed during verification');
      }
      
      const verifyChecksum = await computeChecksum(verifyJson);
      if (verifyChecksum !== checksum) {
        logger.error(`[VaultStorage] Verification FAILED: Checksum mismatch (expected ${checksum}, got ${verifyChecksum})`);
        throw new Error('Checksum mismatch after save');
      }
      
      logger.info('[VaultStorage] Verification PASSED: All chunks saved correctly');
      
      // Only remove old chunks after successful verification
      const oldKeys = currentKeys.filter(k => k !== VAULT_META_KEY && !chunkKeys.includes(k));
      if (oldKeys.length > 0) {
        logger.info(`[VaultStorage] Removing ${oldKeys.length} old chunks: ${oldKeys.join(', ')}`);
        await chrome.storage.sync.remove(oldKeys);
      }
      
      await chrome.storage.local.set({ vault_backup: vault });
      logger.info('[VaultStorage] Backup updated in local storage');
      
      const newQuota = await quotaService.getVaultQuota();
      
      return {
        success: true,
        bytesUsed: newQuota.used,
        bytesAvailable: newQuota.available,
        warningLevel: newQuota.warningLevel
      };
    } catch (error) {
      logger.error('[VaultStorage] Failed to save:', error);
      return {
        success: false,
        error: 'SYNC_FAILED',
        bytesUsed: quota.used,
        bytesAvailable: quota.available
      };
    }
  },

  migrateFromLegacy: async (config: VaultStorageConfig): Promise<MigrationResult> => {
    try {
      const [syncData, localData] = await Promise.all([
        chrome.storage.sync.get([LEGACY_VAULT_KEY, VAULT_META_KEY]),
        chrome.storage.local.get([LEGACY_VAULT_KEY])
      ]);
      
      const meta = syncData[VAULT_META_KEY] as VaultMeta | undefined;
      if (meta?.version === STORAGE_VERSION) {
        return { migrated: false, itemCount: 0, from: 'none' };
      }
      
      const syncLegacyVault = syncData[LEGACY_VAULT_KEY] as VaultItem[] | undefined;
      if (syncLegacyVault && Array.isArray(syncLegacyVault) && syncLegacyVault.length > 0) {
        if (config.syncEnabled) {
          const result = await vaultService.saveVault(syncLegacyVault, config);
          if (result.success) {
            await chrome.storage.sync.remove(LEGACY_VAULT_KEY);
            return { migrated: true, itemCount: syncLegacyVault.length, from: 'sync_legacy' };
          } else {
            await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: syncLegacyVault });
            await chrome.storage.sync.remove(LEGACY_VAULT_KEY);
            return { 
              migrated: true, 
              itemCount: syncLegacyVault.length, 
              from: 'sync_legacy',
              error: 'Moved to local storage due to quota limits'
            };
          }
        } else {
          await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: syncLegacyVault });
          await chrome.storage.sync.remove(LEGACY_VAULT_KEY);
          return { migrated: true, itemCount: syncLegacyVault.length, from: 'sync_legacy' };
        }
      }
      
      const localLegacyVault = localData[LEGACY_VAULT_KEY] as VaultItem[] | undefined;
      if (localLegacyVault && Array.isArray(localLegacyVault) && localLegacyVault.length > 0) {
        if (config.syncEnabled) {
          const result = await vaultService.saveVault(localLegacyVault, config);
          if (result.success) {
            await chrome.storage.local.remove(LEGACY_VAULT_KEY);
            return { migrated: true, itemCount: localLegacyVault.length, from: 'local_legacy' };
          }
          return { migrated: false, itemCount: localLegacyVault.length, from: 'local_legacy', fallbackToLocal: true };
        }
        return { migrated: false, itemCount: localLegacyVault.length, from: 'local_legacy' };
      }
      
      return { migrated: false, itemCount: 0, from: 'none' };
    } catch (error) {
      logger.error('[VaultStorage] Migration failed:', error);
      return { migrated: false, itemCount: 0, error: String(error) };
    }
  },

  toggleSyncMode: async (
    currentVault: VaultItem[],
    enableSync: boolean
  ): Promise<VaultStorageResult> => {
    if (enableSync) {
      const result = await vaultService.saveVault(currentVault, { syncEnabled: true });
      if (result.success) {
        await chrome.storage.local.remove(LEGACY_VAULT_KEY);
      }
      return result;
    } else {
      try {
        await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: currentVault });
        const verify = await chrome.storage.local.get([LEGACY_VAULT_KEY]);
        if (!verify[LEGACY_VAULT_KEY] || JSON.stringify(verify[LEGACY_VAULT_KEY]) !== JSON.stringify(currentVault)) {
          return {
            success: false,
            error: 'SYNC_FAILED',
            bytesUsed: 0,
            bytesAvailable: 0
          };
        }
        const keys = await getVaultChunkKeys();
        if (keys.length > 0) {
          await chrome.storage.sync.remove(keys);
        }
        return { success: true };
      } catch (error) {
        logger.error('[VaultStorage] Failed to disable sync:', error);
        return {
          success: false,
          error: 'SYNC_FAILED',
          bytesUsed: 0,
          bytesAvailable: 0
        };
      }
    }
  }
};

export { getVaultChunkKeys };
