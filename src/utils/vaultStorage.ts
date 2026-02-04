import { vaultService } from '../services/vaultService';
import { quotaService } from '../services/quotaService';

export const {
  loadVault,
  saveVault,
  migrateFromLegacy,
  toggleSyncMode
} = vaultService;

export const {
  getVaultQuota,
  getStorageStats
} = quotaService;
