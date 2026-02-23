# Storage System Improvements

This document outlines potential improvements to the vault storage system.

## Overview

The current storage system uses `chrome.storage.sync` for vault persistence with chunking and LZ-String compression. While functional, several improvements can enhance reliability, performance, and user experience.

---

## 1. Pre-flight Quota Check

**Problem**: Quota validation happens during `persistVault`, after the UI has already updated. This causes visual glitches when the operation fails.

**Solution**: Check available space before mutating state in `moveToVault` and `saveToVault`.

```typescript
// In useVaultSlice.ts

async function moveToVault(id: UniversalId) {
  const { vault, quota } = get();
  const item = findItemInList(islands, id);
  
  // Pre-flight check
  const estimatedSize = estimateItemSize(item);
  const safetyMargin = VAULT_QUOTA_SAFETY_MARGIN_BYTES * 2;
  
  if (quota.available - estimatedSize < safetyMargin) {
    // Auto-enable local-only mode
    logger.info('[VaultSlice] Auto-switching to local storage due to quota');
    await setVaultSyncEnabled(false);
    return;
  }
  
  // Proceed with move...
}
```

**Benefits**: Faster user feedback, prevents state inconsistencies.

---

## 2. Proactive Chunk Cleanup

**Problem**: Chunks may become orphaned during interrupted writes or schema migrations.

**Solution**: Add cleanup utility that runs on extension initialization.

```typescript
// In quotaService.ts

export const quotaService = {
  // ...existing methods
  
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
  }
};
```

**Usage**: Call on extension startup:
```typescript
// In background.ts or store initialization
await quotaService.cleanupOrphanedChunks();
```

**Benefits**: Recovers wasted quota, prevents corruption accumulation.

---

## 3. Enhanced UI Feedback

**Problem**: Users are not notified when sync storage is full or has fallen back to local storage.

**Solution**: Implement quota warning components and toast notifications.

```typescript
// In VaultPanel.tsx

interface VaultPanelProps {
  quota: VaultQuotaInfo | null;
  quotaExceededPending: VaultStorageResult | null;
}

export function VaultPanel({ quota, quotaExceededPending }: VaultPanelProps) {
  return (
    <div className="vault-panel">
      {quotaExceededPending && (
        <QuotaBanner
          variant="warning"
          message="Sync storage full - using local storage"
          action={
            <button onClick={() => clearQuotaExceeded()}>
              Dismiss
            </button>
          }
        />
      )}
      
      {quota?.warningLevel === 'critical' && (
        <QuotaBanner
          variant="error"
          message="Vault storage nearly full. Consider exporting or clearing old items."
          action={
            <button onClick={() => openStorageManager()}>
              Manage Storage
            </button>
          }
        />
      )}
      
      {/* Existing vault content */}
    </div>
  );
}
```

```typescript
// Toast notification utility
function showQuotaToast(level: 'warning' | 'critical') {
  toast({
    title: level === 'critical' ? 'Storage Critical' : 'Storage Warning',
    message: level === 'critical' 
      ? 'Vault sync disabled. See storage settings.'
      : 'Storage usage high',
    type: level,
    duration: 5000
  });
}
```

**Benefits**: Better user awareness, reduced confusion.

---

## 4. Storage Health Monitoring

**Problem**: No centralized way to assess overall storage health.

**Solution**: Add health check endpoint.

```typescript
// In quotaService.ts

export type StorageHealthStatus = 'healthy' | 'degraded' | 'critical';

export const quotaService = {
  // ...existing methods
  
  getStorageHealth: async (): Promise<StorageHealthStatus> => {
    const [syncStats, localStats] = await Promise.all([
      chrome.storage.sync.getBytesInUse(null),
      chrome.storage.local.getBytesInUse(null)
    ]);
    
    const syncUsageRatio = syncStats / CHROME_SYNC_QUOTA_BYTES;
    
    if (syncUsageRatio > 0.95) return 'critical';
    if (syncUsageRatio > 0.85) return 'degraded';
    
    // Check for orphaned chunks
    const orphanedCount = await countOrphanedChunks();
    if (orphanedCount > 5) return 'degraded';
    
    return 'healthy';
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
    const [health, stats, meta] = await Promise.all([
      quotaService.getStorageHealth(),
      quotaService.getStorageStats(),
      chrome.storage.sync.get('vault_meta')
    ]);
    
    const orphanedCount = await quotaService.cleanupOrphanedChunks();
    
    return {
      health,
      syncUsed: stats.syncUsed,
      syncTotal: stats.syncTotal,
      localUsed: stats.localUsed,
      vaultItemCount: stats.vaultItemCount,
      orphanedChunks: orphanedCount,
      lastSyncTime: (meta as any).vault_meta?.timestamp || null
    };
  }
};
```

**Usage**:
```typescript
// In settings or debug page
const report = await quotaService.getStorageHealth();
console.log('Storage health:', report);
```

**Benefits**: Proactive monitoring, easier debugging.

---

## 5. Incremental/Differential Saves

**Problem**: The entire vault is serialized and saved on every change, even for single-item modifications.

**Solution**: Track changes and save only deltas.

```typescript
// Track dirty items in vaultService
const dirtyItems = new Set<VaultItem['id']>();
const deletedItems = new Set<VaultItem['id']>();

function markDirty(item: VaultItem) {
  dirtyItems.add(item.id);
}

function markDeleted(id: VaultItem['id']) {
  deletedItems.add(id);
  dirtyItems.delete(id);
}

async function saveVaultDiff(): Promise<VaultStorageResult> {
  const { vault } = await loadVault({ syncEnabled: true });
  
  // Build patch
  const patch = {
    added: vault.filter(i => dirtyItems.has(i.id)),
    deleted: Array.from(deletedItems),
    timestamp: Date.now()
  };
  
  // Store diff in separate chunk
  const diffKey = 'vault_diff';
  const compressed = LZString.compressToUTF16(JSON.stringify(patch));
  
  try {
    await chrome.storage.sync.set({ [diffKey]: compressed });
    
    // Clear tracking sets on success
    dirtyItems.clear();
    deletedItems.clear();
    
    return { success: true };
  } catch (error) {
    return { success: false, error: 'SYNC_FAILED' };
  }
}
```

**Benefits**: Reduces write operations, minimizes quota usage.

---

## 6. Multi-tier Compression Strategy

**Problem**: A single compression approach may not work for all data types.

**Solution**: Implement compression tiers that strip non-essential data first.

```typescript
const COMPRESSION_TIERS = {
  tier1: {
    name: 'standard',
    compress: (vault: VaultItem[]) => LZString.compressToUTF16(JSON.stringify(vault)),
    strips: []
  },
  tier2: {
    name: 'no-favicons',
    compress: (vault: VaultItem[]) => {
      const stripped = vault.map(item => ({
        ...item,
        favicon: '' // Remove favicon data
      }));
      return LZString.compressToUTF16(JSON.stringify(stripped));
    },
    strips: ['favicon']
  },
  tier3: {
    name: 'minimal',
    compress: (vault: VaultItem[]) => {
      const minimal = vault.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        savedAt: item.savedAt,
        originalId: item.originalId
      }));
      return LZString.compressToUTF16(JSON.stringify(minimal));
    },
    strips: ['favicon', 'color', 'collapsed']
  }
};

async function saveWithCompressionTiers(
  vault: VaultItem[]
): Promise<VaultStorageResult> {
  const quota = await getVaultQuota();
  
  for (const [tierName, tier] of Object.entries(COMPRESSION_TIERS)) {
    const compressed = tier.compress(vault);
    const bytesNeeded = compressed.length * 2;
    
    if (bytesNeeded < quota.available) {
      try {
        await chrome.storage.sync.set({ 'vault_compressed': compressed });
        logger.info(`[VaultStorage] Saved using ${tierName} compression`);
        return { success: true, compressionTier: tierName };
      } catch {
        continue; // Try next tier
      }
    }
  }
  
  // Final fallback to local
  return saveToLocalStorage(vault);
}
```

**Benefits**: Maximizes sync storage efficiency.

---

## Priority Ranking

| Priority | Improvement | Impact | Effort |
|----------|-------------|--------|--------|
| High | Pre-flight quota check | High | Low |
| High | Enhanced UI feedback | High | Medium |
| Medium | Incremental saves | Medium | High |
| Medium | Storage health monitoring | Medium | Low |
| Low | Proactive chunk cleanup | Low | Low |
| Low | Multi-tier compression | Low | Medium |

---

## Related Files

- `src/services/vaultService.ts` - Core storage logic
- `src/services/quotaService.ts` - Quota monitoring
- `src/store/slices/useVaultSlice.ts` - Vault state management
- `src/constants.ts` - Storage constants
