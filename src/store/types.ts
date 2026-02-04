import { TabSlice } from './slices/useTabSlice';
import { VaultSlice } from './slices/useVaultSlice';
import { UISlice } from './slices/useUISlice';
import { AppearanceSlice } from './slices/useAppearanceSlice';

export type StoreState = TabSlice & VaultSlice & UISlice & AppearanceSlice;
