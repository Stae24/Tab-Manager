import LZString from 'lz-string';
import type {
  VaultItem,
  VaultStorageConfig,
  VaultStorageResult,
  VaultQuotaInfo,
  VaultMeta,
  MigrationResult,
  QuotaWarningLevel
} from '../types/index';

const SYNC_TOTAL_QUOTA = 102400;
const SETTINGS_RESERVE = 10240;
const VAULT_CHUNK_SIZE = 6144;
const WARNING_THRESHOLD = 0.80;
const CRITICAL_THRESHOLD = 0.90;
const STORAGE_VERSION = 2;

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

function getWarningLevel(percentage: number): QuotaWarningLevel {
  if (percentage >= CRITICAL_THRESHOLD) return 'critical';
  if (percentage >= WARNING_THRESHOLD) return 'warning';
  return 'none';
}

async function getVaultChunkKeys(): Promise<string[]> {
  const metaResult = await chrome.storage.sync.get(VAULT_META_KEY);
  const meta = metaResult[VAULT_META_KEY] as VaultMeta | undefined;
  
  if (meta && Array.isArray(meta.chunkKeys)) {
    return [VAULT_META_KEY, ...meta.chunkKeys];
  }

  // Fallback to legacy discovery if meta is missing or doesn't have chunkKeys
  const allKeys = await chrome.storage.sync.get(null);
  return Object.keys(allKeys).filter(
    key => key === VAULT_META_KEY || key.startsWith(VAULT_CHUNK_PREFIX)
  );
}

export async function getVaultQuota(): Promise<VaultQuotaInfo> {
  const settingsKeys = ['appearanceSettings', 'dividerPosition', 'showVault', 'vaultSyncEnabled'];
  const [settingsBytes, vaultKeys] = await Promise.all([
    chrome.storage.sync.getBytesInUse(settingsKeys),
    getVaultChunkKeys()
  ]);
  
  const vaultBytes = vaultKeys.length > 0 
    ? await chrome.storage.sync.getBytesInUse(vaultKeys)
    : 0;
  
  const settingsTotal = Math.max(settingsBytes, SETTINGS_RESERVE);
  const available = SYNC_TOTAL_QUOTA - settingsTotal;
  const percentage = available > 0 ? vaultBytes / available : 1;
  
  return {
    used: vaultBytes,
    available: available - vaultBytes,
    total: available,
    percentage,
    warningLevel: getWarningLevel(percentage)
  };
}

export async function saveVault(
  vault: VaultItem[],
  config: VaultStorageConfig
): Promise<VaultStorageResult> {
  const jsonData = JSON.stringify(vault);
  const checksum = await computeChecksum(jsonData);
  
  if (!config.syncEnabled) {
    await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault });
    await chrome.storage.local.set({ vault_backup: vault });
    return { success: true };
  }
  
  const compressed = LZString.compressToUTF16(jsonData);
  const compressedBytes = compressed.length * 2;
  
  const quota = await getVaultQuota();
  const currentKeys = await getVaultChunkKeys();
  const currentVaultBytes = await chrome.storage.sync.getBytesInUse(currentKeys);
  const netNewBytes = compressedBytes - currentVaultBytes;
  
  if (netNewBytes > quota.available) {
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
    chunks.push(compressed.slice(i, i + VAULT_CHUNK_SIZE / 2));
    chunkKeys.push(`${VAULT_CHUNK_PREFIX}${idx}`);
  }
  
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
    
    // Atomic-ish update: write new data first
    await chrome.storage.sync.set(storageData);
    
    // Cleanup orphaned chunks if any
    const oldKeys = currentKeys.filter(k => k !== VAULT_META_KEY && !chunkKeys.includes(k));
    if (oldKeys.length > 0) {
      await chrome.storage.sync.remove(oldKeys);
    }
    
    await chrome.storage.local.set({ vault_backup: vault });
    
    const newQuota = await getVaultQuota();
    
    return {
      success: true,
      bytesUsed: newQuota.used,
      bytesAvailable: newQuota.available,
      warningLevel: newQuota.warningLevel
    };
  } catch (error) {
    console.error('[VaultStorage] Failed to save:', error);
    return {
      success: false,
      error: 'SYNC_FAILED',
      bytesUsed: quota.used,
      bytesAvailable: quota.available
    };
  }
}

export async function loadVault(config: VaultStorageConfig): Promise<VaultItem[]> {
  if (!config.syncEnabled) {
    const local = await chrome.storage.local.get([LEGACY_VAULT_KEY]);
    return (local[LEGACY_VAULT_KEY] as VaultItem[]) || [];
  }
  
  try {
    const syncData = await chrome.storage.sync.get(null);
    const meta = syncData[VAULT_META_KEY] as VaultMeta | undefined;
    
    if (!meta || meta.version !== STORAGE_VERSION) {
      return [];
    }
    
    const chunks: string[] = [];
    const chunkKeys = meta.chunkKeys || Array.from({ length: meta.chunkCount }, (_, i) => `${VAULT_CHUNK_PREFIX}${i}`);
    
    for (let i = 0; i < chunkKeys.length; i++) {
      const chunk = syncData[chunkKeys[i]] as string | undefined;
      if (chunk === undefined) {
        console.error(`[VaultStorage] Missing chunk ${chunkKeys[i]}`);
        return await loadFromBackup();
      }
      chunks.push(chunk);
    }
    
    const compressed = chunks.join('');
    const jsonData = LZString.decompressFromUTF16(compressed);
    
    if (!jsonData) {
      console.error('[VaultStorage] Decompression failed');
      return await loadFromBackup();
    }
    
    const computedChecksum = await computeChecksum(jsonData);
    if (computedChecksum !== meta.checksum) {
      console.error('[VaultStorage] Checksum mismatch, data may be corrupted');
      return await loadFromBackup();
    }
    
    return JSON.parse(jsonData) as VaultItem[];
  } catch (error) {
    console.error('[VaultStorage] Failed to load:', error);
    return await loadFromBackup();
  }
}

async function loadFromBackup(): Promise<VaultItem[]> {
  console.warn('[VaultStorage] Attempting to load from local backup');
  const local = await chrome.storage.local.get(['vault_backup']);
  return (local.vault_backup as VaultItem[]) || [];
}

export async function migrateFromLegacy(config: VaultStorageConfig): Promise<MigrationResult> {
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
        const result = await saveVault(syncLegacyVault, config);
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
        const result = await saveVault(localLegacyVault, config);
        if (result.success) {
          await chrome.storage.local.remove(LEGACY_VAULT_KEY);
          return { migrated: true, itemCount: localLegacyVault.length, from: 'local_legacy' };
        }
      }
      return { migrated: false, itemCount: localLegacyVault.length, from: 'local_legacy' };
    }
    
    return { migrated: false, itemCount: 0, from: 'none' };
  } catch (error) {
    console.error('[VaultStorage] Migration failed:', error);
    return { migrated: false, itemCount: 0, error: String(error) };
  }
}

export async function toggleSyncMode(
  currentVault: VaultItem[],
  enableSync: boolean
): Promise<VaultStorageResult> {
  if (enableSync) {
    const result = await saveVault(currentVault, { syncEnabled: true });
    if (result.success) {
      await chrome.storage.local.remove(LEGACY_VAULT_KEY);
    }
    return result;
  } else {
    await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: currentVault });
    const keys = await getVaultChunkKeys();
    if (keys.length > 0) {
      await chrome.storage.sync.remove(keys);
    }
    return { success: true };
  }
}

export async function getStorageStats(): Promise<{
  syncUsed: number;
  syncTotal: number;
  localUsed: number;
  vaultItemCount: number;
}> {
  const [syncBytes, localBytes, localData] = await Promise.all([
    chrome.storage.sync.getBytesInUse(null),
    chrome.storage.local.getBytesInUse(null),
    chrome.storage.local.get([LEGACY_VAULT_KEY, 'vault_backup'])
  ]);
  
  const vault = (localData[LEGACY_VAULT_KEY] || localData.vault_backup || []) as VaultItem[];
  
  return {
    syncUsed: syncBytes,
    syncTotal: SYNC_TOTAL_QUOTA,
    localUsed: localBytes,
    vaultItemCount: vault.length
  };
}
