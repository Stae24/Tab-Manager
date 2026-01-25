export type UniversalId = number | string;

export interface Tab {
  id: UniversalId;
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
  id: UniversalId;
  title: string;
  color: string;
  collapsed: boolean;
  tabs: Tab[];
}

export type LiveItem = Island | Tab;

export type VaultItem = (Island | Tab) & {
  savedAt: number;
  originalId?: number; // Track original Chrome ID for reference
};
