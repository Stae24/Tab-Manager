import LZString from 'lz-string';
import type {
  VaultItem,
  VaultTab,
  VaultIsland,
  VaultStorageConfig,
  VaultStorageResult,
  VaultMeta,
  MigrationResult,
  VaultLoadResult,
  CompressionTier,
  Tab,
  Island,
  MinifiedVaultWithDomains,
  UniversalId
} from '../types/index';
import { quotaService } from './quotaService';
import {
  STORAGE_VERSION,
  VAULT_CHUNK_SIZE,
  CHROME_SYNC_ITEM_MAX_BYTES,
  VAULT_QUOTA_SAFETY_MARGIN_BYTES,
  COMPRESSION_TIERS
} from '../constants';
import { VAULT_META_KEY, VAULT_CHUNK_PREFIX, VAULT_DIFF_KEY, LEGACY_VAULT_KEY, getVaultChunkKeys } from './storageKeys';
import { logger } from '../utils/logger';

const getByteLength = (str: string): number => new TextEncoder().encode(str).length;

const PER_ITEM_SAFETY_BUFFER_BYTES = 16;

/**
 * Computes the storage size of a sync storage item as Chrome measures it.
 * This is: byteLength(key) + byteLength(JSON.stringify(value))
 * JSON.stringify is used because Chrome stringifies values for storage accounting.
 */
function getStorageItemBytes(key: string, value: unknown): number {
  const keyBytes = new TextEncoder().encode(key).length;
  const valueBytes = new TextEncoder().encode(JSON.stringify(value)).length;
  return keyBytes + valueBytes;
}

/**
 * Estimates the bytes that Chrome's getBytesInUse would report for vault data.
 * This simulates the chunking process and sums UTF-8 encoded sizes (key + value + JSON quotes).
 * Matches how Chrome actually measures quota for sync storage.
 */
function estimateBytesInUse(
  compressed: string,
  tier: CompressionTier = 'full',
  minified: boolean = false,
  domainDedup: boolean = false
): number {
  let total = 0;
  let offset = 0;
  let chunkIndex = 0;

  // Simulate chunking (same logic as createPreciseChunks)
  while (offset < compressed.length) {
    const key = `${VAULT_CHUNK_PREFIX}${chunkIndex}`;
    const maxBytes = CHROME_SYNC_ITEM_MAX_BYTES - PER_ITEM_SAFETY_BUFFER_BYTES;

    // Binary search for chunk boundary (matching createPreciseChunks)
    let low = offset;
    let high = compressed.length;
    let bestEnd = offset;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const chunk = compressed.slice(offset, mid);
      const itemBytes = getStorageItemBytes(key, chunk);

      if (itemBytes <= maxBytes) {
        bestEnd = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestEnd === offset) {
      bestEnd = offset + 1;
    }

    const chunk = compressed.slice(offset, bestEnd);
    total += getStorageItemBytes(key, chunk);

    offset = bestEnd;
    chunkIndex++;
  }

  // Add meta key overhead
  const chunkKeys = Array.from({ length: chunkIndex }, (_, i) => `${VAULT_CHUNK_PREFIX}${i}`);
  const meta = {
    version: STORAGE_VERSION,
    chunkCount: chunkIndex,
    chunkKeys,
    checksum: 'a'.repeat(64), // SHA-256 hex is always 64 chars
    timestamp: Date.now(),
    compressed: true,
    compressionTier: tier,
    minified,
    domainDedup
  };
  total += getStorageItemBytes(VAULT_META_KEY, meta);

  return total;
}

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'ref', 'source', '_ga', 'mc_cid', 'mc_eid'
]);

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return url;
    }

    let hostname = parsed.hostname.replace(/^www\./, '');

    const params = new URLSearchParams(parsed.search);
    for (const key of Array.from(params.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        params.delete(key);
      }
    }

    const protocolMarker = parsed.protocol === 'https:' ? 's:' : 'h:';
    let normalized = protocolMarker + hostname;

    if (parsed.port) {
      normalized += ':' + parsed.port;
    }

    if (parsed.pathname && parsed.pathname !== '/') {
      let path = parsed.pathname;
      if (path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      normalized += path;
    }

    const cleanSearch = params.toString();
    if (cleanSearch) {
      normalized += '?' + cleanSearch;
    }

    if (parsed.hash && parsed.hash !== '#') {
      normalized += parsed.hash;
    }

    return normalized;
  } catch {
    return url;
  }
}

function denormalizeUrl(normalized: string): string {
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  if (normalized.startsWith('s:')) {
    return 'https://' + normalized.slice(2);
  }
  if (normalized.startsWith('h:')) {
    return 'http://' + normalized.slice(2);
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    return normalized;
  }

  return 'https://' + normalized;
}

const KEY_MAP = {
  id: 'i', title: 't', url: 'u', favicon: 'f',
  savedAt: 's', originalId: 'o', color: 'c',
  collapsed: 'k', tabs: 'b',
  wasPinned: 'wp', wasMuted: 'wm', wasFrozen: 'wf'
} as const;

export const KEY_ORDER = ['id', 'title', 'url', 'favicon', 'savedAt', 'originalId', 'color', 'collapsed', 'tabs', 'wasPinned', 'wasMuted', 'wasFrozen'] as const;

const REVERSE_KEY_MAP: Record<string, string> = {
  i: 'id', t: 'title', u: 'url', f: 'favicon',
  s: 'savedAt', o: 'originalId', c: 'color',
  k: 'collapsed', b: 'tabs',
  wp: 'wasPinned', wm: 'wasMuted', wf: 'wasFrozen'
};

function minifyVaultTab(tab: VaultTab): unknown[] {
  const result: unknown[] = [];
  for (const key of KEY_ORDER) {
    if (key === 'tabs' || key === 'color' || key === 'collapsed') {
      result.push(null);
      continue;
    }
    const value = tab[key as keyof VaultTab];
    if (value !== undefined) {
      result.push(value);
    } else {
      result.push(null);
    }
  }
  return result;
}

function minifyVaultIsland(island: VaultIsland): unknown[] {
  const result: unknown[] = [];
  for (const key of KEY_ORDER) {
    const value = island[key as keyof VaultIsland];
    if (key === 'tabs' && Array.isArray(value)) {
      result.push((value as VaultTab[]).map(minifyVaultTab));
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
    return minifyVaultIsland(item as VaultIsland);
  }
  return minifyVaultTab(item as VaultTab);
}

function minifyVaultItemWithNormalizedUrls(item: VaultItem): unknown[] {
  if ('tabs' in item && Array.isArray(item.tabs)) {
    const island = item as VaultIsland;
    const result: unknown[] = [];
    for (const key of KEY_ORDER) {
      const value = island[key as keyof VaultIsland];
      if (key === 'tabs' && Array.isArray(value)) {
        result.push((value as VaultTab[]).map(tab => minifyVaultTab({ ...tab, url: normalizeUrl(tab.url) })));
      } else if (value !== undefined) {
        result.push(value);
      } else {
        result.push(null);
      }
    }
    return result;
  }
  const tab = item as VaultTab;
  const result: unknown[] = [];
  for (const key of KEY_ORDER) {
    if (key === 'tabs' || key === 'color' || key === 'collapsed') {
      result.push(null);
      continue;
    }
    const value = tab[key as keyof VaultTab];
    if (key === 'url' && typeof value === 'string') {
      result.push(normalizeUrl(value));
    } else if (value !== undefined) {
      result.push(value);
    } else {
      result.push(null);
    }
  }
  return result;
}

type MinifyResult = unknown[] | MinifiedVaultWithDomains;

function minifyVault(vault: VaultItem[]): MinifyResult {
  if (vault.length < 3) {
    return vault.map(minifyVaultItemWithNormalizedUrls);
  }

  const domainSet = new Set<string>();
  let totalUrlLength = 0;

  for (const item of vault) {
    if (isTabWithUrl(item)) {
      const { domain } = extractDomain(normalizeUrl(item.url));
      domainSet.add(domain);
      totalUrlLength += item.url.length;
    } else if ('tabs' in item && Array.isArray(item.tabs)) {
      for (const tab of item.tabs) {
        const { domain } = extractDomain(normalizeUrl(tab.url));
        domainSet.add(domain);
        totalUrlLength += tab.url.length;
      }
    }
  }

  const domains = Array.from(domainSet);
  const domainOverhead = JSON.stringify(domains).length;
  const estimatedSavings = totalUrlLength * 0.4;

  if (estimatedSavings > domainOverhead * 1.2) {
    return minifyVaultWithDomains(vault);
  }

  return vault.map(minifyVaultItemWithNormalizedUrls);
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

function denormalizeUrlInItem(item: VaultItem): VaultItem {
  if (isTabWithUrl(item)) {
    item.url = denormalizeUrl(item.url);
  } else if ('tabs' in item && Array.isArray(item.tabs)) {
    for (const tab of item.tabs) {
      tab.url = denormalizeUrl(tab.url);
    }
  }
  return item;
}

function expandVault(data: unknown[]): VaultItem[] {
  return data.map((item: unknown) => expandVaultItem(item as unknown[]));
}

function expandVaultWithDenormalization(data: unknown[]): VaultItem[] {
  return data.map((item: unknown) => {
    const expanded = expandVaultItem(item as unknown[]);
    return denormalizeUrlInItem(expanded);
  });
}

function extractDomain(normalizedUrl: string): { domain: string; path: string } {
  const slashIndex = normalizedUrl.indexOf('/');
  const queryIndex = normalizedUrl.indexOf('?');
  const hashIndex = normalizedUrl.indexOf('#');

  let splitIndex = normalizedUrl.length;
  if (slashIndex !== -1) splitIndex = Math.min(splitIndex, slashIndex);
  if (queryIndex !== -1) splitIndex = Math.min(splitIndex, queryIndex);
  if (hashIndex !== -1) splitIndex = Math.min(splitIndex, hashIndex);

  const domain = normalizedUrl.slice(0, splitIndex);
  const path = normalizedUrl.slice(splitIndex);

  return { domain, path };
}

function isTabWithUrl(item: VaultItem): item is VaultTab {
  return 'url' in item && typeof item.url === 'string';
}

function collectUrlsFromVault(vault: VaultItem[]): string[] {
  const urls: string[] = [];
  for (const item of vault) {
    if (isTabWithUrl(item)) {
      urls.push(item.url);
    } else if ('tabs' in item && Array.isArray(item.tabs)) {
      for (const tab of item.tabs) {
        urls.push(tab.url);
      }
    }
  }
  return urls;
}

function minifyVaultWithDomains(vault: VaultItem[]): MinifiedVaultWithDomains {
  const domainMap = new Map<string, number>();
  const domains: string[] = [];

  const itemsWithDomainRefs = vault.map(item => {
    if (isTabWithUrl(item)) {
      const normalizedUrl = normalizeUrl(item.url);
      const { domain, path } = extractDomain(normalizedUrl);

      let domainIndex = domainMap.get(domain);
      if (domainIndex === undefined) {
        domainIndex = domains.length;
        domains.push(domain);
        domainMap.set(domain, domainIndex);
      }

      return {
        ...item,
        url: `${domainIndex}${path}`
      };
    } else {
      const island = item as VaultIsland;
      const normalizedTabs = island.tabs.map(tab => {
        const normalizedUrl = normalizeUrl(tab.url);
        const { domain, path } = extractDomain(normalizedUrl);

        let domainIndex = domainMap.get(domain);
        if (domainIndex === undefined) {
          domainIndex = domains.length;
          domains.push(domain);
          domainMap.set(domain, domainIndex);
        }

        return {
          ...tab,
          url: `${domainIndex}${path}`
        };
      });

      return {
        ...island,
        tabs: normalizedTabs
      } as VaultIsland;
    }
  });

  const items = itemsWithDomainRefs.map(item => minifyVaultItem(item as VaultItem));

  return { version: 1, domains, items };
}

function reconstructUrl(urlString: string, domains: string[]): string {
  const urlMatch = urlString.match(/^(\d+)(.*)$/);
  if (urlMatch) {
    const domainIndex = parseInt(urlMatch[1], 10);
    const path = urlMatch[2];
    if (Number.isSafeInteger(domainIndex) && domainIndex >= 0 && domainIndex < domains.length) {
      return denormalizeUrl(domains[domainIndex] + path);
    }
  }
  return denormalizeUrl(urlString);
}

function expandVaultWithDomains(data: MinifiedVaultWithDomains): VaultItem[] {
  const { domains, items } = data;

  return items.map(item => {
    const expanded = expandVaultItem(item);

    if (isTabWithUrl(expanded)) {
      expanded.url = reconstructUrl(String(expanded.url), domains);
    } else if ('tabs' in expanded && Array.isArray(expanded.tabs)) {
      for (const tab of expanded.tabs) {
        tab.url = reconstructUrl(String(tab.url), domains);
      }
    }

    return expanded;
  });
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
      (stripped as VaultIsland).color = 'grey';
    }
    if ('collapsed' in stripped) {
      (stripped as VaultIsland).collapsed = false;
    }
  }

  return stripped;
}

function applyCompressionTierToVault(vault: VaultItem[], tier: CompressionTier): VaultItem[] {
  return vault.map(item => applyCompressionTier(item, tier));
}

let saveLock: Promise<VaultStorageResult> | null = null;

async function computeChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadFromBackup(): Promise<VaultItem[]> {
  logger.warn('VaultService', 'Attempting to load from local backup');
  const local = await chrome.storage.local.get(['vault_backup']);
  return (local.vault_backup as VaultItem[]) || [];
}

async function clearAllVaultChunks(): Promise<void> {
  logger.info('VaultService', 'Clearing all vault sync chunks...');
  const allSyncData = await chrome.storage.sync.get(null);
  const vaultKeys = Object.keys(allSyncData).filter(
    key => key === VAULT_META_KEY || key.startsWith(VAULT_CHUNK_PREFIX) || key === VAULT_DIFF_KEY
  );
  if (vaultKeys.length > 0) {
    await chrome.storage.sync.remove(vaultKeys);
    logger.info('VaultService', `Removed ${vaultKeys.length} vault-related keys from sync`);
  }
}

function createPreciseChunks(
  compressed: string,
  maxBytesOverride?: number
): { chunks: string[]; keys: string[] } {
  const chunks: string[] = [];
  const keys: string[] = [];

  let offset = 0;
  let chunkIndex = 0;

  while (offset < compressed.length) {
    const key = `${VAULT_CHUNK_PREFIX}${chunkIndex}`;
    const maxBytes = (maxBytesOverride ?? CHROME_SYNC_ITEM_MAX_BYTES) - PER_ITEM_SAFETY_BUFFER_BYTES;

    let low = offset;
    let high = compressed.length;
    let bestEnd = offset;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const chunk = compressed.slice(offset, mid);
      const itemBytes = getStorageItemBytes(key, chunk);

      if (itemBytes <= maxBytes) {
        bestEnd = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestEnd === offset) {
      const singleCharChunk = compressed.slice(offset, offset + 1);
      const singleCharBytes = getStorageItemBytes(key, singleCharChunk);
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

async function tryCompressionTiers(
  vault: VaultItem[],
  availableBytes: number
): Promise<{ tier: CompressionTier; compressed: string; minified: boolean; domainDedup: boolean }> {
  for (const tier of COMPRESSION_TIERS) {
    const tieredVault = applyCompressionTierToVault(vault, tier);

    const minified = minifyVault(tieredVault);
    const minifiedJson = JSON.stringify(minified);
    const minifiedCompressed = LZString.compressToUTF16(minifiedJson);
    const minifiedBytes = estimateBytesInUse(minifiedCompressed, tier, true, !Array.isArray(minified) && 'domains' in minified);

    if (minifiedBytes <= availableBytes) {
      const domainDedup = !Array.isArray(minified) && 'domains' in minified;
      logger.info('VaultService', `Compression tier ${tier} with minification fits: ${minifiedBytes} <= ${availableBytes}, domainDedup: ${domainDedup}`);
      return { tier, compressed: minifiedCompressed, minified: true, domainDedup };
    }

    const regularJson = JSON.stringify(tieredVault);
    const regularCompressed = LZString.compressToUTF16(regularJson);
    const regularBytes = estimateBytesInUse(regularCompressed, tier, false, false);

    if (regularBytes <= availableBytes) {
      logger.info('VaultService', `Compression tier ${tier} without minification fits: ${regularBytes} <= ${availableBytes}`);
      return { tier, compressed: regularCompressed, minified: false, domainDedup: false };
    }
  }

  logger.debug('VaultService', `All compression tiers exhausted. Available: ${availableBytes}`);
  throw new Error('Vault too large for any compression tier');
}

function migrateLegacyVaultItem(item: unknown): VaultItem | null {
  if (!item || typeof item !== 'object') return null;

  const legacy = item as Record<string, unknown>;

  if ('tabs' in legacy && Array.isArray(legacy.tabs)) {
    const migratedTabs: VaultTab[] = [];
    for (const tab of legacy.tabs) {
      const migratedTab = migrateLegacyVaultTab(tab);
      if (migratedTab) migratedTabs.push(migratedTab);
    }

    return {
      id: legacy.id as UniversalId,
      title: String(legacy.title || ''),
      color: String(legacy.color || 'grey'),
      collapsed: Boolean(legacy.collapsed),
      tabs: migratedTabs,
      savedAt: Number(legacy.savedAt) || Date.now(),
      originalId: legacy.originalId as UniversalId ?? legacy.id as UniversalId,
    };
  }

  return migrateLegacyVaultTab(legacy);
}

function migrateLegacyVaultTab(tab: unknown): VaultTab | null {
  if (!tab || typeof tab !== 'object') return null;

  const legacy = tab as Record<string, unknown>;

  const migrated: VaultTab = {
    id: legacy.id as UniversalId,
    title: String(legacy.title || ''),
    url: String(legacy.url || ''),
    favicon: String(legacy.favicon || ''),
    savedAt: Number(legacy.savedAt) || Date.now(),
    originalId: legacy.originalId as UniversalId ?? legacy.id as UniversalId,
  };

  if (legacy.pinned) migrated.wasPinned = true;
  if (legacy.muted) migrated.wasMuted = true;
  if (legacy.discarded) migrated.wasFrozen = true;

  return migrated;
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
      logger.info('VaultService', 'Loading vault from sync storage...');

      const metaResult = await chrome.storage.sync.get(VAULT_META_KEY);
      const meta = metaResult[VAULT_META_KEY] as VaultMeta | undefined;

      if (!meta) {
        logger.warn('VaultService', 'No meta found in sync storage. This is normal for first-time users. Loading from local without fallback flag.');
        return { vault: await loadFromBackup(), timestamp: 0, fallbackToLocal: false };
      }

      logger.info('VaultService', `Found meta: version=${meta.version}, chunkCount=${meta.chunkCount}, chunkKeys.length=${meta.chunkKeys?.length || 0}, minified=${meta.minified}, domainDedup=${meta.domainDedup}`);

      if (meta.version < STORAGE_VERSION) {
        logger.warn('VaultService', `Version mismatch: expected ${STORAGE_VERSION}, got ${meta.version}. Attempting to load data anyway.`);
      }

      const chunks: string[] = [];
      const chunkKeys = meta.chunkKeys || Array.from({ length: meta.chunkCount }, (_, i) => `${VAULT_CHUNK_PREFIX}${i}`);

      logger.info('VaultService', `Attempting to load ${chunkKeys.length} chunks`);
      logger.debug('VaultService', `Chunk keys to fetch: ${chunkKeys.join(', ')}`);

      const keysToFetch = [VAULT_META_KEY, ...chunkKeys];
      const syncData = await chrome.storage.sync.get(keysToFetch);

      const retrievedKeys = Object.keys(syncData);
      logger.debug('VaultService', `Retrieved ${retrievedKeys.length} items: ${retrievedKeys.join(', ')}`);

      const missingChunks = chunkKeys.filter(key => syncData[key] === undefined);
      if (missingChunks.length > 0) {
        logger.error('VaultService', `🔴 FALLBACK TRIGGERED: Missing ${missingChunks.length} chunks`);
        logger.error('VaultService', `  - chunkCount in meta: ${meta.chunkCount}`);
        logger.error('VaultService', `  - chunkKeys.length in meta: ${meta.chunkKeys?.length || 0}`);
        logger.error('VaultService', `  - Missing chunk keys: ${missingChunks.join(', ')}`);
        logger.error('VaultService', `  - Available in storage: ${retrievedKeys.filter(k => k.startsWith(VAULT_CHUNK_PREFIX)).join(', ')}`);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
      }

      for (let i = 0; i < chunkKeys.length; i++) {
        const chunk = syncData[chunkKeys[i]] as string | undefined;
        if (chunk === undefined) {
          logger.error('VaultService', `🔴 Unexpected: Chunk ${chunkKeys[i]} was not found despite passing earlier check`);
          return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
        }
        const chunkSize = chunk.length * 2;
        logger.debug('VaultService', `Chunk ${chunkKeys[i]}: FOUND, size=${chunkSize} bytes`);
        chunks.push(chunk);
      }

      const totalCompressedSize = chunks.reduce((sum, chunk) => sum + chunk.length * 2, 0);
      logger.info('VaultService', `All ${chunks.length} chunks loaded. Total compressed size: ${totalCompressedSize} bytes`);

      const compressed = chunks.join('');
      const jsonData = LZString.decompressFromUTF16(compressed);

      if (!jsonData) {
        logger.error('VaultService', '🔴 FALLBACK TRIGGERED: Decompression failed');
        logger.error('VaultService', `  - Compressed size: ${compressed.length} chars`);
        logger.error('VaultService', `  - This indicates corrupted or incomplete data`);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
      }

      const computedChecksum = await computeChecksum(jsonData);
      if (computedChecksum !== meta.checksum) {
        logger.error('VaultService', `🔴 FALLBACK TRIGGERED: Checksum mismatch`);
        logger.error('VaultService', `  - Expected: ${meta.checksum}`);
        logger.error('VaultService', `  - Computed: ${computedChecksum}`);
        logger.error('VaultService', `  - Data may have been corrupted in transit`);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp, fallbackToLocal: true };
      }

      let parsed: VaultItem[];
      try {
        const rawParsed = JSON.parse(jsonData);

        if (rawParsed && typeof rawParsed === 'object' && 'domains' in rawParsed) {
          logger.info('VaultService', 'Expanding domain-deduplicated vault data');
          parsed = expandVaultWithDomains(rawParsed as MinifiedVaultWithDomains);
        } else if (meta.minified && Array.isArray(rawParsed) && rawParsed.length > 0) {
          if (Array.isArray(rawParsed[0])) {
            logger.info('VaultService', 'Expanding minified vault data');
            parsed = expandVaultWithDenormalization(rawParsed);
          } else {
            parsed = rawParsed as VaultItem[];
          }
        } else {
          parsed = rawParsed as VaultItem[];
        }

        if (!Array.isArray(parsed)) {
          logger.error('VaultService', 'Parsed data is not an array, loading from backup');
          return { vault: await loadFromBackup(), timestamp: meta.timestamp };
        }

        const needsMigration = parsed.some((item: unknown) => {
          if (!item || typeof item !== 'object') return false;
          const i = item as Record<string, unknown>;
          return 'active' in i || 'discarded' in i || 'windowId' in i || 'index' in i || 'groupId' in i || 'audible' in i || 'pinned' in i || 'muted' in i;
        });

        if (needsMigration) {
          logger.info('VaultService', `Migrating ${parsed.length} legacy vault items to new format`);
          const migrated = parsed.map(migrateLegacyVaultItem).filter((item): item is VaultItem => item !== null);
          parsed = migrated;
        }
      } catch (parseError) {
        logger.error('VaultService', 'JSON parse failed, loading from backup:', parseError);
        return { vault: await loadFromBackup(), timestamp: meta.timestamp };
      }

      logger.info('VaultService', `✅ Load successful: ${parsed.length} items`);
      return {
        vault: parsed,
        timestamp: meta.timestamp
      };
    } catch (error) {
      logger.error('VaultService', 'Failed to load, using backup:', error);
      return { vault: await loadFromBackup(), timestamp: 0 };
    }
  },

  saveVault: async (
    vault: VaultItem[],
    config: VaultStorageConfig
  ): Promise<VaultStorageResult> => {
    const doSaveWithRetry = async (
      isRetryAttempt: boolean,
      availableBytes: number
    ): Promise<VaultStorageResult> => {
      const quota = await quotaService.getVaultQuota();
      const currentKeys = await getVaultChunkKeys();
      let storageData: Record<string, unknown> = {};

      try {
        if (isRetryAttempt) {
          logger.info('VaultService', '🔄 RETRY: Using stricter chunk limits');
        }

        const effectiveAvailableBytes = isRetryAttempt ? availableBytes : quota.total - VAULT_QUOTA_SAFETY_MARGIN_BYTES;

        if (!isRetryAttempt) {
          logger.debug('VaultService', `saveVault: availableBytes=${effectiveAvailableBytes}, syncEnabled=${config.syncEnabled}`);
          logger.info('VaultService', '📊 Quota state BEFORE save:');
          logger.info('VaultService', `  - Available: ${effectiveAvailableBytes} bytes (with safety margin)`);
        }

        const { tier, compressed, minified, domainDedup } = await tryCompressionTiers(vault, effectiveAvailableBytes);
        logger.debug('VaultService', `saveVault: using tier=${tier}, size=${compressed.length * 2} bytes`);
        const compressedBytes = compressed.length * 2;

        logger.info('VaultService', `Using compression tier: ${tier}, minified: ${minified}, domainDedup: ${domainDedup}, size: ${compressedBytes} bytes`);

        const minifiedData = minified
          ? minifyVault(applyCompressionTierToVault(vault, tier))
          : null;
        const checksumData = minified
          ? JSON.stringify(minifiedData)
          : JSON.stringify(applyCompressionTierToVault(vault, tier));
        const checksum = await computeChecksum(checksumData);

        // Use reduced max bytes for chunks on retry (doubled safety buffer)
        const maxBytesOverride = isRetryAttempt
          ? CHROME_SYNC_ITEM_MAX_BYTES - (PER_ITEM_SAFETY_BUFFER_BYTES * 2)
          : undefined;
        const { chunks, keys: chunkKeys } = createPreciseChunks(compressed, maxBytesOverride);

        if (isRetryAttempt) {
          logger.info('VaultService', `Retry created ${chunks.length} chunks with reduced limits`);
        } else {
          logger.info('VaultService', `Created ${chunks.length} chunks using precise byte boundaries`);
        }

        const meta: VaultMeta = {
          version: STORAGE_VERSION,
          chunkCount: chunks.length,
          chunkKeys,
          checksum,
          timestamp: Date.now(),
          compressed: true,
          compressionTier: tier,
          minified,
          domainDedup
        };

        storageData = {
          [VAULT_META_KEY]: meta
        };

        chunks.forEach((chunk, index) => {
          storageData[chunkKeys[index]] = chunk;
        });

        // Log predicted sizes before write
        const itemSizes = Object.entries(storageData).map(([key, value]) => ({
          key,
          bytes: getStorageItemBytes(key, value)
        }));
        const maxItemSize = Math.max(...itemSizes.map(i => i.bytes));
        logger.info('VaultService', `${isRetryAttempt ? 'Retry ' : ''}Max predicted per-item size: ${maxItemSize} bytes (limit: ${CHROME_SYNC_ITEM_MAX_BYTES})`);
        if (isRetryAttempt) {
          logger.debug('VaultService', 'Retry predicted item sizes:', itemSizes);
        }

        logger.info('VaultService', `Saving ${Object.keys(storageData).length} items to sync storage...`);
        await chrome.storage.sync.set(storageData);
        logger.info('VaultService', 'Save completed, verifying...');

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

        logger.info('VaultService', 'Verification PASSED: All chunks saved correctly');

        const oldKeys = currentKeys.filter(k => k !== VAULT_META_KEY && !chunkKeys.includes(k));
        if (oldKeys.length > 0) {
          logger.info('VaultService', `Removing ${oldKeys.length} old chunks`);
          await chrome.storage.sync.remove(oldKeys);
        }

        await chrome.storage.sync.remove(VAULT_DIFF_KEY).catch(() => { });

        await quotaService.cleanupOrphanedChunks();
        await chrome.storage.local.set({ vault_backup: vault });

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
        logger.error('VaultService', '❌ SYNC WRITE FAILED:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('too large');
        const isPerItemQuotaError = errorMessage.includes('QUOTA_BYTES_PER_ITEM') ||
                                     errorMessage.includes('kQuotaBytesPerItem');

        // Retry with stricter chunk limits on per-item quota error
        if (isPerItemQuotaError && !isRetryAttempt) {
          logger.warn('VaultService', 'Per-item quota exceeded, retrying with stricter chunk limits...');

          // Log diagnostic info
          const itemSizes = Object.entries(storageData).map(([key, value]) => ({
            key,
            bytes: getStorageItemBytes(key, value)
          }));
          const maxItemSize = Math.max(...itemSizes.map(i => i.bytes));
          logger.info('VaultService', `Max predicted per-item size before failure: ${maxItemSize} bytes (limit: ${CHROME_SYNC_ITEM_MAX_BYTES})`);
          logger.debug('VaultService', 'Predicted item sizes:', itemSizes);

          return doSaveWithRetry(true, availableBytes);
        }

        if (isQuotaError) {
          logger.error('VaultService', '🔴 FALLBACK TRIGGERED: Quota error');
        }

        await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault }).catch((e) => {
          logger.error('VaultService', 'Failed to save to local storage:', e);
        });
        await chrome.storage.local.set({ vault_backup: vault }).catch((e) => {
          logger.error('VaultService', 'Failed to save backup:', e);
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
    };

    const doSave = async (): Promise<VaultStorageResult> => {
      if (!config.syncEnabled) {
        await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault });
        await chrome.storage.local.set({ vault_backup: vault });
        return { success: true };
      }

      const quota = await quotaService.getVaultQuota();
      const availableBytes = quota.total - VAULT_QUOTA_SAFETY_MARGIN_BYTES;

      return doSaveWithRetry(false, availableBytes);
    };

    const lockChain = (saveLock || Promise.resolve()).catch(() => {});
    const newLock = lockChain.then(() => doSave());
    saveLock = newLock;
    try {
      return await newLock;
    } finally {
      if (saveLock === newLock) {
        saveLock = null;
      }
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
        logger.info('VaultService', 'Upgrading from v2 to v3 format');
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
      logger.error('VaultService', 'Migration failed:', error);
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
      logger.info('VaultService', 'Disabling vault sync, clearing chunks...');

      let localSaveFailed = false;
      await chrome.storage.local.set({ [LEGACY_VAULT_KEY]: vault }).catch((e) => {
        logger.error('VaultService', 'Failed to save legacy vault to local storage:', e);
        localSaveFailed = true;
      });
      await chrome.storage.local.set({ vault_backup: vault }).catch((e) => {
        logger.error('VaultService', 'Failed to save backup to local storage:', e);
        localSaveFailed = true;
      });

      if (localSaveFailed) {
        logger.error('VaultService', 'Local storage writes failed during disableVaultSync');
        throw new Error('Local storage write failed');
      }

      const keys = await getVaultChunkKeys();
      if (keys.length > 0) {
        await chrome.storage.sync.remove(keys);
        logger.info('VaultService', `Removed ${keys.length} sync chunks`);
      }

      const quota = await quotaService.getVaultQuota();

      return {
        success: true,
        bytesUsed: quota.used,
        bytesAvailable: quota.available,
        warningLevel: 'none'
      };
    } catch (error) {
      logger.error('VaultService', 'Failed to disable sync:', error);
      return {
        success: false,
        error: 'SYNC_FAILED',
        bytesUsed: 0,
        bytesAvailable: 0
      };
    }
  },

  recoverVaultSync: async (vault: VaultItem[]): Promise<VaultStorageResult> => {
    logger.info('VaultService', 'Starting vault sync recovery...');

    await clearAllVaultChunks();

    const result = await vaultService.saveVault(vault, { syncEnabled: true });

    if (result.success && !result.fallbackToLocal) {
      logger.info('VaultService', '✅ Recovery successful');
    } else {
      logger.warn('VaultService', '🔴 Recovery failed, falling back to local');
    }

    return result;
  },

  estimateBytesInUse: (
    compressed: string,
    tier: CompressionTier = 'full',
    minified: boolean = false,
    domainDedup: boolean = false
  ): number => {
    return estimateBytesInUse(compressed, tier, minified, domainDedup);
  }
};
