import LZString from 'lz-string';
import type {
  VaultItem,
  VaultStorageConfig,
  VaultStorageResult,
  VaultMeta,
  MigrationResult,
  VaultLoadResult,
  CompressionTier,
  VaultDiff,
  Tab,
  Island
} from '../types/index';
import { quotaService } from './quotaService';
import { 
  STORAGE_VERSION, 
  VAULT_CHUNK_SIZE, 
  CHROME_SYNC_ITEM_MAX_BYTES, 
  VAULT_QUOTA_SAFETY_MARGIN_BYTES, 
  SYNC_SETTINGS_RESERVE_BYTES,
  VAULT_DIFF_KEY,
  DIFF_COMPACT_THRESHOLD,
  COMPRESSION_TIERS
} from '../constants';
import { VAULT_META_KEY, VAULT_CHUNK_PREFIX, LEGACY_VAULT_KEY, getVaultChunkKeys } from './storageKeys';
import { logger } from '../utils/logger';

const getByteLength = (str: string): number => new TextEncoder().encode(str).length;

const KEY_MAP = {
  id: 'i', title: 't', url: 'u', favicon: 'f', 
  savedAt: 's', originalId: 'o', color: 'c', 
  collapsed: 'k', tabs: 'b', active: 'a', 
  discarded: 'd', windowId: 'w', index: 'n', 
  groupId: 'g', muted: 'm', pinned: 'p', audible: 'z'
} as const;

const KEY_ORDER = ['id', 'title', 'url', 'favicon', 'savedAt', 'originalId', 'color', 'collapsed', 'tabs', 'active', 'discarded', 'windowId', 'index', 'groupId', 'muted', 'pinned', 'audible'] as const;

const REVERSE_KEY_MAP: Record<string, string> = {
  i: 'id', t: 'title', u: 'url', f: 'favicon', 
  s: 'savedAt', o: 'originalId', c: 'color', 
  k: 'collapsed', b: 'tabs', a: 'active', 
  d: 'discarded', w: 'windowId', n: 'index', 
  g: 'groupId', m: 'muted', p: 'pinned', z: 'audible'
};

function minifyTab(tab: Tab): unknown[] {
  const result: unknown[] = [];
  for (const key of KEY_ORDER) {
    if (key === 'tabs') {
      result.push(null);
      continue;
    }
    const value = tab[key as keyof Tab];
    if (value !== undefined) {
      result.push(value);
    } else {
      result.push(null);
    }
  }
  return result;
}

function minifyIsland(island: Island & { savedAt: number; originalId: unknown }): unknown[] {
  const result: unknown[] = [];
  for (const key of KEY_ORDER) {
    const value = island[key as keyof typeof island];
    if (key === 'tabs' && Array.isArray(value)) {
      result.push((value as Tab[]).map(minifyTab));
    } else if (value !== undefined) {
      result.push(value);
    } else {
      result.push(null);
    }
  }
  return result;
}

function minifyVaultItem(item: VaultItem): unknown[] {
  if ('tabs' in item && Array.isArray(item.tabs)) {
    return minifyIsland(item as Island & { savedAt: number; originalId: unknown });
  }
  return minifyTab(item as Tab);
}

function minifyVault(vault: VaultItem[]): unknown[] {
  return vault.map(minifyVaultItem);
}

function expandTab(data: unknown[]): VaultItem {
  const tab: Record<string, unknown> = {};
  for (let i = 0; i < KEY_ORDER.length; i++) {
    const key = KEY_ORDER[i];
    if (key === 'tabs') continue;
    const value = data[i];
    if (value !== null && value !== undefined) {
      tab[key] = value;
    }
  }
  return tab as unknown as VaultItem;
}

function expandIsland(data: unknown[]): VaultItem {
  const island: Record<string, unknown> = {};
  for (let i = 0; i < KEY_ORDER.length; i++) {
    const key = KEY_ORDER[i];
    const value = data[i];
    if (key === 'tabs' && Array.isArray(value)) {
      island[key] = value.map((t: unknown) => expandTab(t as unknown[]));
    } else if (value !== null && value !== undefined) {
      island[key] = value;
    }
  }
  return island as unknown as VaultItem;
}

function expandVaultItem(data: unknown[]): VaultItem {
  if (Array.isArray(data[8])) {
    return expandIsland(data);
  }
  return expandTab(data);
}

function expandVault(data: unknown[]): VaultItem[] {
  return data.map((item: unknown) => expandVaultItem(item as unknown[]));
}

function applyCompressionTier(item: VaultItem, tier: CompressionTier): VaultItem {
  if (tier === 'full') return item;
  
  const stripped = JSON.parse(JSON.stringify(item)) as VaultItem;
  
  if (tier === 'no_favicons' || tier === 'minimal') {
    if ('favicon' in stripped) {
      const tabItem = stripped as Tab & VaultItem;
      tabItem.favicon = '';
    }
    if ('tabs' in stripped && Array.isArray(stripped.tabs)) {
      stripped.tabs = stripped.tabs.map(t => {
        const tab = { ...t };
        tab.favicon = '';
        return tab;
      });
    }
  }
  
  if (tier === 'minimal') {
    if ('color' in stripped) {
      (stripped as Island).color = 'grey';
    }
    if ('collapsed' in stripped) {
      (stripped as Island).collapsed = false;
    }
  }
  
  return stripped;
}

function applyCompressionTierToVault(vault: VaultItem[], tier: CompressionTier): VaultItem[] {
  return vault.map(item => applyCompressionTier(item, tier));
}

let previousVaultState: VaultItem[] | null = null;
let lastFullSaveTime = 0;

function computeDiff(previous: VaultItem[], current: VaultItem[]): VaultDiff {
  const currentIds = new Set(current.map(i => String(i.id)));
  const previousIds = new Set(previous.map(i => String(i.id)));
  
  const added = current.filter(i => !previousIds.has(String(i.id)));
  const deleted = previous.filter(i => !currentIds.has(String(i.id))).map(i => String(i.id));
  
  return { added, deleted, timestamp: Date.now() };
}

function shouldUseDiffMode(diff: VaultDiff, fullVault: VaultItem[]): boolean {
  if (diff.added.length === 0 && diff.deleted.length === 0) {
    return false;
  }
  
  const diffSize = JSON.stringify(diff).length;
  const fullSize = JSON.stringify(fullVault).length;
  
  if (fullSize === 0) return false;
  
  return diffSize < fullSize * DIFF_COMPACT_THRESHOLD;
}

async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadFromBackup(): Promise<VaultItem[]> {
  logger.warn('[VaultStorage] Attempting to load from local backup');
  const local = await chrome.storage.local.get(['vault_backup']);
  return (local.vault_backup as VaultItem[]) || [];
}

async function clearAllVaultChunks(): Promise<void> {
  logger.info('[VaultStorage] Clearing all vault sync chunks...');
  const allSyncData = await chrome.storage.sync.get(null);
  const vaultKeys = Object.keys(allSyncData).filter(
    key => key === VAULT_META_KEY || key.startsWith(VAULT_CHUNK_PREFIX) || key === VAULT_DIFF_KEY
  );
  if (vaultKeys.length > 0) {
    await chrome.storage.sync.remove(vaultKeys);
    logger.info(`[VaultStorage] Removed ${vaultKeys.length} vault-related keys from sync`);
  }
}

function createPreciseChunks(compressed: string): { chunks: string[]; keys: string[] } {
  const chunks: string[] = [];
  const keys: string[] = [];
  const encoder = new TextEncoder();
  
  let offset = 0;
  let chunkIndex = 0;
  
  while (offset < compressed.length) {
    const key = `${VAULT_CHUNK_PREFIX}${chunkIndex}`;
    const maxBytes = CHROME_SYNC_ITEM_MAX_BYTES - key.length - 2;
    
    let low = offset;
    let high = compressed.length;
    let bestEnd = offset;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const chunk = compressed.slice(offset, mid);
      const bytes = encoder.encode(chunk).length;
      
      if (bytes <= maxBytes) {
        bestEnd = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    if (bestEnd === offset) {
      const singleCharBytes = encoder.encode(compressed.slice(offset, offset + 1)).length;
      if (singleCharBytes > maxBytes) {
        throw new Error(`Single character at position ${offset} exceeds chunk size limit (${singleCharBytes} > ${maxBytes} bytes)`);
      }
      bestEnd = offset + 1;
    }
    
    const chunk = compressed.slice(offset, bestEnd);
    chunks.push(chunk);
    keys.push(key);
    
    offset = bestEnd;
    chunkIndex++;
  }
  
  return { chunks, keys };
}

async function loadDiff(): Promise<VaultDiff | null> {
  try {
    const diffData = await chrome.storage.sync.get(VAULT_DIFF_KEY);
    const stored = diffData[VAULT_DIFF_KEY];
    if (!stored) {
      return null;
    }
    if (typeof stored === 'object' && !Array.isArray(stored)) {
      return stored as VaultDiff;
    }
    if (typeof stored === 'string') {
      const decompressed = LZString.decompressFromUTF16(stored);
      if (!decompressed) {
        logger.warn('[VaultStorage] Failed to decompress diff');
        return null;
      }
      return JSON.parse(decompressed) as VaultDiff;
    }
  } catch {
    logger.warn('[VaultStorage] Failed to load diff');
  }
  return null;
}

async function saveDiff(diff: VaultDiff): Promise<void> {
  const compressed = LZString.compressToUTF16(JSON.stringify(diff));
  await chrome.storage.sync.set({ [VAULT_DIFF_KEY]: compressed });
}

async function applyDiff(baseVault: VaultItem[], diff: VaultDiff): Promise<VaultItem[]> {
  const deletedIds = new Set(diff.deleted);
  const vault = baseVault.filter(i => !deletedIds.has(String(i.id)));
  vault.push(...diff.added);
  return vault;
}

async function tryCompressionTiers(
  vault: VaultItem[],
  availableBytes: number
): Promise<{ tier: CompressionTier; compressed: string; minified: boolean }> {
  for (const tier of COMPRESSION_TIERS) {
    const tieredVault = applyCompressionTierToVault(vault, tier);
    
    const minified = minifyVault(tieredVault);
    const minifiedJson = JSON.stringify(minified);
    const minifiedCompressed = LZString.compressToUTF16(minifiedJson);
    const minifiedBytes = minifiedCompressed.length * 2;
    
    if (minifiedBytes <= availableBytes) {
      logger.info(`[VaultStorage] Compression tier ${tier} with minification fits: ${minifiedBytes} <= ${availableBytes}`);
      return { tier, compressed: minifiedCompressed, minified: true };
    }
    
    const regularJson = JSON.stringify(tieredVault);
    const regularCompressed = LZString.compressToUTF16(regularJson);
    const regularBytes = regularCompressed.length * 2;
    
    if (regularBytes <= availableBytes) {
      logger.info(`[VaultStorage] Compression tier ${tier} without minification fits: ${regularBytes} <= ${availableBytes}`);
      return { tier, compressed: regularCompressed, minified: false };
    }
  }
  
  throw new Error('Vault too large for any compression tier');
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
      
      const metaResult = await chrome.storage.sync.get(VAULT_META_KEY);
      const meta = metaResult[VAULT_META_KEY] as VaultMeta | undefined;
      
      if (!meta) {
        logger.warn('[VaultStorage] No meta found in sync storage. This is normal for first-time users. Loading from local without fallback flag.');
        return { vault: await loadFromBackup(), timestamp: 0, fallbackToLocal: false };
      }
      
      logger.info(`[VaultStorage] Found meta: version=${meta.version}, chunkCount=${meta.chunkCount}, chunkKeys.length=${meta.chunkKeys?.length || 0}, minified=${meta.minified}`);
      
      if (meta.version < STORAGE_VERSION) {
        logger.warn(`[VaultStorage] Version mismatch: expected ${STORAGE_VERSION}, got ${meta.version}. Attempting to load data anyway.`);
      }
      
      const chunks: string[] = [];
      const chunkKeys = meta.chunkKeys || Array.from({ length: meta.chunkCount }, (_, i) => `${VAULT_CHUNK_PREFIX}${i}`);
      
      logger.info(`[VaultStorage] Attempting to load ${chunkKeys.length} chunks`);
      logger.debug(`[VaultStorage] Chunk keys to fetch: ${chunkKeys.join(', ')}`);
      
      const keysToFetch = [VAULT_META_KEY, ...chunkKeys];
      const syncData = await chrome.storage.sync.get(keysToFetch);
      
      const retrievedKeys = Object.keys(syncData);
      logger.debug(`[VaultStorage] Retrieved ${retrievedKeys.length} items: ${retrievedKeys.join(', ')}`);
      
      const missingChunks = chunkKeys.filter(key => syncData[key] === undefined);
      if (missingChunks.length > 0) {
        logger.error(`[VaultStorage] 🔴 FALLBACK TRIGGERED: Missing ${missingChunks.length} chunks`);
        logger.error(`[VaultStorage]   - chunkCount in meta: ${meta.chunkCount}`);
        logger.error(`[VaultStorage]   - chunkKeys.length in meta: ${meta.chunkKeys?.length || 0}`);
        logger.error(`[VaultStorage]   - Missing chunk keys: ${missingChunks.join(', ')}`);
        logger.error(`[VaultStorage]   - Available in storage: ${retrievedKeys.filter(k => k.startsWith(VAULT_CHUNK_PREFIX)).join(', ')}`);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
      }
      
      for (let i = 0; i < chunkKeys.length; i++) {
        const chunk = syncData[chunkKeys[i]] as string | undefined;
        if (chunk === undefined) {
          logger.error(`[VaultStorage] 🔴 Unexpected: Chunk ${chunkKeys[i]} was not found despite passing earlier check`);
          return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
        }
        const chunkSize = chunk.length * 2;
        logger.debug(`[VaultStorage] Chunk ${chunkKeys[i]}: FOUND, size=${chunkSize} bytes`);
        chunks.push(chunk);
      }
      
      const totalCompressedSize = chunks.reduce((sum, chunk) => sum + chunk.length * 2, 0);
      logger.info(`[VaultStorage] All ${chunks.length} chunks loaded. Total compressed size: ${totalCompressedSize} bytes`);

      const compressed = chunks.join('');
      const jsonData = LZString.decompressFromUTF16(compressed);

      if (!jsonData) {
        logger.error('[VaultStorage] 🔴 FALLBACK TRIGGERED: Decompression failed');
        logger.error(`[VaultStorage]   - Compressed size: ${compressed.length} chars`);
        logger.error(`[VaultStorage]   - This indicates corrupted or incomplete data`);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
      }

      const computedChecksum = await computeChecksum(jsonData);
      if (computedChecksum !== meta.checksum) {
        logger.error(`[VaultStorage] 🔴 FALLBACK TRIGGERED: Checksum mismatch`);
        logger.error(`[VaultStorage]   - Expected: ${meta.checksum}`);
        logger.error(`[VaultStorage]   - Computed: ${computedChecksum}`);
        logger.error(`[VaultStorage]   - Data may have been corrupted in transit`);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
      }
      
      let parsed: VaultItem[];
      try {
        const rawParsed = JSON.parse(jsonData);
        
        if (meta.minified && Array.isArray(rawParsed) && rawParsed.length > 0) {
          if (Array.isArray(rawParsed[0])) {
            logger.info('[VaultStorage] Expanding minified vault data');
            parsed = expandVault(rawParsed);
          } else {
            parsed = rawParsed as VaultItem[];
          }
        } else {
          parsed = rawParsed as VaultItem[];
        }
        
        if (!Array.isArray(parsed)) {
          logger.error('[VaultStorage] Parsed data is not an array, loading from backup');
          return { vault: await loadFromBackup(), timestamp: meta.timestamp };
        }
      } catch (parseError) {
        logger.error('[VaultStorage] JSON parse failed, loading from backup:', parseError);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp };
      }

      const diff = await loadDiff();
      if (diff) {
        logger.info(`[VaultStorage] Applying diff: ${diff.added.length} added, ${diff.deleted.length} deleted`);
        parsed = await applyDiff(parsed, diff);
      }

      previousVaultState = parsed;
      
      logger.info(`[VaultStorage] ✅ Load successful: ${parsed.length} items`);
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
    if (!config.syncEnabled) {
      await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault });
      await chrome.storage.local.set({ vault_backup: vault });
      previousVaultState = vault;
      return { success: true };
    }
    
    const quota = await quotaService.getVaultQuota();
    const currentKeys = await getVaultChunkKeys();
    const currentVaultBytes = await chrome.storage.sync.getBytesInUse(currentKeys);
    
    const diff = previousVaultState ? computeDiff(previousVaultState, vault) : null;
    
    if (diff && shouldUseDiffMode(diff, vault)) {
      logger.info(`[VaultStorage] Using incremental save: ${diff.added.length} added, ${diff.deleted.length} deleted`);
      
      try {
        const diffCompressed = LZString.compressToUTF16(JSON.stringify(diff));
        const diffBytes = diffCompressed.length * 2;
        
        if (diffBytes < quota.available - VAULT_QUOTA_SAFETY_MARGIN_BYTES) {
          await saveDiff(diff);
          await chrome.storage.local.set({ vault_backup: vault });
          previousVaultState = vault;
          
          return {
            success: true,
            bytesUsed: quota.used + diffBytes,
            bytesAvailable: quota.available - diffBytes,
            warningLevel: quota.warningLevel
          };
        }
      } catch (error) {
        logger.warn('[VaultStorage] Diff save failed, falling back to full save:', error);
      }
    }
    
    try {
      const availableBytes = quota.available - VAULT_QUOTA_SAFETY_MARGIN_BYTES;
      
      logger.info(`[VaultStorage] 📊 Quota state BEFORE save:`);
      logger.info(`[VaultStorage]   - Available: ${availableBytes} bytes (with safety margin)`);
      
      const { tier, compressed, minified } = await tryCompressionTiers(vault, availableBytes);
      const compressedBytes = compressed.length * 2;
      
      logger.info(`[VaultStorage] Using compression tier: ${tier}, minified: ${minified}, size: ${compressedBytes} bytes`);
      
      const checksumData = minified 
        ? JSON.stringify(minifyVault(applyCompressionTierToVault(vault, tier)))
        : JSON.stringify(applyCompressionTierToVault(vault, tier));
      const checksum = await computeChecksum(checksumData);
      
      const { chunks, keys: chunkKeys } = createPreciseChunks(compressed);
      
      logger.info(`[VaultStorage] Created ${chunks.length} chunks using precise byte boundaries`);
      
      const meta: VaultMeta = {
        version: STORAGE_VERSION,
        chunkCount: chunks.length,
        chunkKeys,
        checksum,
        timestamp: Date.now(),
        compressed: true,
        compressionTier: tier,
        minified
      };
      
      const storageData: Record<string, unknown> = {
        [VAULT_META_KEY]: meta
      };
      
      chunks.forEach((chunk, index) => {
        storageData[chunkKeys[index]] = chunk;
      });
      
      logger.info(`[VaultStorage] Saving ${Object.keys(storageData).length} items to sync storage...`);
      await chrome.storage.sync.set(storageData);
      logger.info('[VaultStorage] Save completed, verifying...');
      
      const verifyKeys = [VAULT_META_KEY, ...chunkKeys];
      const verifyData = await chrome.storage.sync.get(verifyKeys);
      
      const verifyMeta = verifyData[VAULT_META_KEY] as VaultMeta | undefined;
      if (!verifyMeta) {
        throw new Error('Meta missing after save');
      }
      
      const verifyChunks: string[] = [];
      for (const key of chunkKeys) {
        const chunk = verifyData[key] as string | undefined;
        if (chunk === undefined) {
          throw new Error(`Chunk ${key} missing after save`);
        }
        verifyChunks.push(chunk);
      }
      
      const verifyCompressed = verifyChunks.join('');
      const verifyJson = LZString.decompressFromUTF16(verifyCompressed);
      
      if (!verifyJson) {
        throw new Error('Decompression failed during verification');
      }
      
      const verifyChecksum = await computeChecksum(verifyJson);
      if (verifyChecksum !== checksum) {
        throw new Error('Checksum mismatch after save');
      }
      
      logger.info('[VaultStorage] Verification PASSED: All chunks saved correctly');
      
      const oldKeys = currentKeys.filter(k => k !== VAULT_META_KEY && !chunkKeys.includes(k) && k !== VAULT_DIFF_KEY);
      if (oldKeys.length > 0) {
        logger.info(`[VaultStorage] Removing ${oldKeys.length} old chunks`);
        await chrome.storage.sync.remove(oldKeys);
      }
      
      await chrome.storage.sync.remove(VAULT_DIFF_KEY).catch(() => {});
      
      await quotaService.cleanupOrphanedChunks();
      await chrome.storage.local.set({ vault_backup: vault });
      
      previousVaultState = vault;
      lastFullSaveTime = Date.now();
      
      const newQuota = await quotaService.getVaultQuota();
      
      const result: VaultStorageResult = {
        success: true,
        bytesUsed: newQuota.used,
        bytesAvailable: newQuota.available,
        warningLevel: newQuota.warningLevel
      };
      
      if (tier !== 'full') {
        result.compressionTier = tier;
      }
      
      return result;
    } catch (error) {
      logger.error('[VaultStorage] ❌ SYNC WRITE FAILED:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('too large');
      
      if (isQuotaError) {
        logger.error(`[VaultStorage] 🔴 FALLBACK TRIGGERED: Quota error`);
      }
      
      await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault }).catch((e) => {
        logger.error('[VaultStorage] Failed to save to local storage:', e);
      });
      await chrome.storage.local.set({ vault_backup: vault }).catch((e) => {
        logger.error('[VaultStorage] Failed to save backup:', e);
      });
      
      const newQuota = await quotaService.getVaultQuota();
      
      return {
        success: true,
        fallbackToLocal: true,
        bytesUsed: newQuota.used,
        bytesAvailable: newQuota.available,
        warningLevel: 'critical'
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
      
      if (meta?.version === 2 && config.syncEnabled) {
        logger.info('[VaultStorage] Upgrading from v2 to v3 format');
        const newMeta: VaultMeta = {
          ...meta,
          version: STORAGE_VERSION,
          minified: false,
          compressionTier: 'full'
        };
        await chrome.storage.sync.set({ [VAULT_META_KEY]: newMeta });
        return { migrated: true, itemCount: 0, from: 'none' };
      }
      
       const syncLegacyVault = syncData[LEGACY_VAULT_KEY] as VaultItem[] | undefined;
       if (syncLegacyVault && Array.isArray(syncLegacyVault) && syncLegacyVault.length > 0) {
         if (config.syncEnabled) {
           const result = await vaultService.saveVault(syncLegacyVault, config);
           if (!result.fallbackToLocal) {
             await chrome.storage.sync.remove(LEGACY_VAULT_KEY);
             return { migrated: true, itemCount: syncLegacyVault.length, from: 'sync_legacy' };
           } else {
             await vaultService.disableVaultSync(syncLegacyVault);
             await chrome.storage.sync.remove(LEGACY_VAULT_KEY);
             return {
               migrated: true,
               itemCount: syncLegacyVault.length,
               from: 'sync_legacy',
               fallbackToLocal: true
             };
           }
         } else {
           await vaultService.disableVaultSync(syncLegacyVault);
           return {
             migrated: true,
             itemCount: syncLegacyVault.length,
             from: 'sync_legacy',
             fallbackToLocal: true
           };
         }
       }

       const localLegacyVault = localData[LEGACY_VAULT_KEY] as VaultItem[] | undefined;
       if (localLegacyVault && Array.isArray(localLegacyVault) && localLegacyVault.length > 0) {
         if (config.syncEnabled) {
           const result = await vaultService.saveVault(localLegacyVault, config);
           if (!result.fallbackToLocal) {
             await chrome.storage.local.remove(LEGACY_VAULT_KEY);
             return { migrated: true, itemCount: localLegacyVault.length, from: 'local_legacy' };
           }
           await vaultService.disableVaultSync(localLegacyVault);
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

      if (result.fallbackToLocal) {
        await vaultService.disableVaultSync(currentVault);
        return result;
      }

      if (result.success) {
        await chrome.storage.local.remove(LEGACY_VAULT_KEY);
      }
      return result;
    } else {
      return vaultService.disableVaultSync(currentVault);
    }
  },

  disableVaultSync: async (vault: VaultItem[]): Promise<VaultStorageResult> => {
    try {
      logger.info('[VaultStorage] Disabling vault sync, clearing chunks...');

      let localSaveFailed = false;
      await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault }).catch((e) => {
        logger.error('[VaultStorage] Failed to save legacy vault to local storage:', e);
        localSaveFailed = true;
      });
      await chrome.storage.local.set({ vault_backup: vault }).catch((e) => {
        logger.error('[VaultStorage] Failed to save backup to local storage:', e);
        localSaveFailed = true;
      });

      if (localSaveFailed) {
        logger.error('[VaultStorage] Local storage writes failed during disableVaultSync');
        throw new Error('Local storage write failed');
      }

      const keys = await getVaultChunkKeys();
      if (keys.length > 0) {
        await chrome.storage.sync.remove(keys);
        logger.info(`[VaultStorage] Removed ${keys.length} sync chunks`);
      }

      const quota = await quotaService.getVaultQuota();

      return {
        success: true,
        bytesUsed: quota.used,
        bytesAvailable: quota.available,
        warningLevel: 'none'
      };
    } catch (error) {
      logger.error('[VaultStorage] Failed to disable sync:', error);
      return {
        success: false,
        error: 'SYNC_FAILED',
        bytesUsed: 0,
        bytesAvailable: 0
      };
    }
  },

  recoverVaultSync: async (vault: VaultItem[]): Promise<VaultStorageResult> => {
    logger.info('[VaultStorage] Starting vault sync recovery...');
    
    await clearAllVaultChunks();
    
    const result = await vaultService.saveVault(vault, { syncEnabled: true });
    
    if (result.success && !result.fallbackToLocal) {
      logger.info('[VaultStorage] ✅ Recovery successful');
    } else {
      logger.warn('[VaultStorage] 🔴 Recovery failed, falling back to local');
    }
    
    return result;
  }
};
