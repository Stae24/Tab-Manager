import type { VaultMeta } from '../types/index';
import { VAULT_META_KEY, VAULT_CHUNK_PREFIX, LEGACY_VAULT_KEY } from '../constants';

export { VAULT_META_KEY, VAULT_CHUNK_PREFIX, LEGACY_VAULT_KEY };

export async function getVaultChunkKeys(): Promise<string[]> {
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
