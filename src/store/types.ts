import { TabSlice } from './slices/useTabSlice';
import { VaultSlice } from './slices/useVaultSlice';
import { UISlice } from './slices/useUISlice';
import { AppearanceSlice } from './slices/useAppearanceSlice';
import { CommandSlice } from './slices/useCommandSlice';

export type StoreState = TabSlice & VaultSlice & UISlice & AppearanceSlice & CommandSlice;
