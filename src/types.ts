export interface Tab {
  id: number;
  title: string;
  url: string;
  favicon: string;
  active: boolean;
  discarded: boolean;
  windowId: number;
  muted?: boolean;
  pinned?: boolean;
  audible?: boolean;
}

export interface Island {
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
  tabs: Tab[];
}

export interface SavedIsland extends Island {
  savedAt: string;
}

export interface VaultItem extends SavedIsland {}

export interface ActionMenu {
  isOpen: boolean;
  tabId: number | null;
  position: { x: number; y: number } | null;
}
