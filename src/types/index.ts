export interface Tab {
  id: number | string; // Changed to allow string-prefixed IDs
  title: string;
  url: string;
  favicon: string;
  active: boolean;
  discarded: boolean;
  windowId: number;
  index: number;
  groupId: number;
  muted?: boolean;
  pinned?: boolean;
  audible?: boolean;
}

export interface Island {
  id: number | string; // Updated to allow string IDs for Vault items
  title: string;
  color: string;
  collapsed: boolean;
  tabs: Tab[];
}

export type VaultItem = (Island | Tab) & {
  savedAt: number;
  id: number | string;
};
