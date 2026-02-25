import { logger } from './logger';

interface NavigatorWithBrave extends Navigator {
  brave?: {
    isBrave: () => Promise<boolean>;
  };
}

export type BrowserVendor = 'brave' | 'chrome' | 'opera' | 'edge' | 'firefox' | 'unknown';

interface BrowserCapabilities {
  vendor: BrowserVendor;
  supportsGroupCollapse: boolean | null;
  supportsSingleTabGroups: boolean | null;
}

let cachedCapabilities: BrowserCapabilities | null = null;

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
    supportsSingleTabGroups: browser !== 'opera'
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
