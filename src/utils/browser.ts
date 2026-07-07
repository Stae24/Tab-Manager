import { logger } from './logger';

interface NavigatorWithBrave extends Navigator {
  brave?: {
    isBrave: () => Promise<boolean>;
  };
}

export type BrowserVendor = 'brave' | 'chrome' | 'opera' | 'edge' | 'firefox' | 'unknown';

export type SidebarApi = 'chrome' | 'opera' | 'none';

interface BrowserCapabilities {
  vendor: BrowserVendor;
  supportsGroupCollapse: boolean | null;
  supportsSingleTabGroups: boolean | null;
  sidebarApi: SidebarApi;
}

let cachedCapabilities: BrowserCapabilities | null = null;

let cachedSidebarApi: SidebarApi | null = null;

/**
 * Feature-detects which sidebar API is available. Feature detection (not UA
 * sniffing) is used because some Chromium-based browsers (e.g. Arc) report as
 * Chrome-like but lack chrome.sidePanel, while Opera implements its own
 * chrome.sidebarAction instead of chrome.sidePanel.
 *
 * Note: Opera's sidebarAction has NO programmatic open/close — the panel is
 * shown when the user clicks the extension's icon in Opera's native sidebar.
 */
export function detectSidebarApi(): SidebarApi {
  if (cachedSidebarApi !== null) return cachedSidebarApi;
  try {
    const chromeNs = chrome as unknown as {
      sidePanel?: { open?: unknown };
      sidebarAction?: unknown;
    };
    if (typeof chromeNs.sidePanel?.open === 'function') {
      cachedSidebarApi = 'chrome';
    } else if (typeof chromeNs.sidebarAction !== 'undefined') {
      cachedSidebarApi = 'opera';
    } else {
      cachedSidebarApi = 'none';
    }
  } catch {
    cachedSidebarApi = 'none';
  }
  return cachedSidebarApi;
}

export function getCachedSidebarApi(): SidebarApi | null {
  return cachedSidebarApi;
}

export function resetSidebarApiCache(): void {
  cachedSidebarApi = null;
}

export async function detectBrowser(): Promise<BrowserVendor> {
  const nav = navigator as NavigatorWithBrave;

  // 1. Brave API (most reliable for Brave)
  if (nav.brave?.isBrave) {
    try {
      if (await nav.brave.isBrave()) return 'brave';
    } catch {
      // Fall through to UA checks
    }
  }

  const ua = navigator.userAgent;

  // 2. Order matters - check specific browsers before generic
  if (ua.includes('Edg/')) return 'edge';     // Edge contains "Chrome" in UA
  if (ua.includes('OPR') || ua.includes('Opera')) return 'opera';
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Chrome')) return 'chrome';  // Must be last

  // 3. Unknown - treat as Chrome-like (safest default for extensions)
  return 'chrome';
}

export async function initBrowserCapabilities(): Promise<boolean> {
  if (cachedCapabilities !== null && cachedCapabilities.supportsGroupCollapse !== null) {
    return cachedCapabilities.supportsGroupCollapse;
  }

  const browser = await detectBrowser();
  const supported = browser !== 'firefox';

  cachedCapabilities = {
    vendor: browser,
    supportsGroupCollapse: supported,
    supportsSingleTabGroups: browser !== 'opera',
    sidebarApi: detectSidebarApi()
  };

  if (browser === 'brave') {
    logger.info('BrowserUtils', 'Brave detected - visual refresh workaround enabled');
  }

  return supported;
}

export async function getBrowserCapabilities(): Promise<BrowserCapabilities> {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  await initBrowserCapabilities();
  return cachedCapabilities!;
}

export function getCachedCapabilities(): BrowserCapabilities | null {
  return cachedCapabilities;
}

export function resetCapabilitiesCache(): void {
  cachedCapabilities = null;
}

export function needsCompanionTabForSingleTabGroup(): boolean {
  const cached = getCachedCapabilities();
  if (cached && cached.supportsSingleTabGroups !== null) {
    return !cached.supportsSingleTabGroups;
  }
  return false;
}

let cachedIsSidebar: boolean | null = null;

export async function detectSidebarContext(): Promise<boolean> {
  if (cachedIsSidebar !== null) return cachedIsSidebar;
  try {
    const tab = await chrome.tabs.getCurrent();
    cachedIsSidebar = tab === undefined;
    return cachedIsSidebar;
  } catch {
    cachedIsSidebar = false;
    return false;
  }
}

export function getCachedSidebarContext(): boolean | null {
  return cachedIsSidebar;
}

export function needsVisualRefreshWorkaround(): boolean {
  const cached = getCachedCapabilities();
  if (!cached) return true; // Default to needing workaround if not initialized
  // Only Opera (and Firefox which has no tab groups) works correctly without the workaround
  return cached.vendor !== 'opera';
}
