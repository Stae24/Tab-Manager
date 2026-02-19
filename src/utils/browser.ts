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
  
  if (nav.brave && typeof nav.brave.isBrave === 'function') {
    try {
      const isBrave = await nav.brave.isBrave();
      if (isBrave) return 'brave';
    } catch {
      // Fall through to other detection
    }
  }
  
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('OPR') || userAgent.includes('Opera')) {
    return 'opera';
  }
  
  if (userAgent.includes('Edg/')) {
    return 'edge';
  }
  
  if (userAgent.includes('Firefox')) {
    return 'firefox';
  }
  
  if (userAgent.includes('Chrome')) {
    return 'chrome';
  }
  
  return 'unknown';
}

export async function initBrowserCapabilities(): Promise<boolean> {
  if (cachedCapabilities !== null) {
    return cachedCapabilities.supportsGroupCollapse ?? true;
  }
  
  const browser = await detectBrowser();
  const supported = browser !== 'firefox';
  
  cachedCapabilities = {
    vendor: browser,
    supportsGroupCollapse: supported,
    supportsSingleTabGroups: browser !== 'opera'
  };
  
  if (browser === 'brave') {
    logger.info('[initBrowserCapabilities] Brave detected - visual refresh workaround enabled');
  }
  
  return supported;
}

export async function getBrowserCapabilities(): Promise<BrowserCapabilities> {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }
  
  const vendor = await detectBrowser();
  
  cachedCapabilities = {
    vendor,
    supportsGroupCollapse: null,
    supportsSingleTabGroups: vendor !== 'opera'
  };
  
  return cachedCapabilities;
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
