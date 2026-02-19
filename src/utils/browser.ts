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
let collapseDetectionAttempted = false;

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

export async function detectGroupCollapseSupport(): Promise<boolean> {
  const browser = await detectBrowser();
  
  if (browser === 'brave') {
    logger.info('[detectCollapseSupport] Brave detected - enabling with visual refresh workaround');
  }
  
  if (collapseDetectionAttempted && cachedCapabilities !== null && cachedCapabilities.supportsGroupCollapse !== null) {
    return cachedCapabilities.supportsGroupCollapse;
  }
  
  try {
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    
    if (groups.length === 0) {
      return true;
    }
    
    const testGroup = groups[0];
    if (!testGroup || testGroup.id === undefined) {
      return true;
    }
    
    const originalCollapsed = testGroup.collapsed;
    const targetCollapsed = !originalCollapsed;
    
    await chrome.tabGroups.update(testGroup.id, { collapsed: targetCollapsed });
    
    const verifyGroup = await chrome.tabGroups.get(testGroup.id);
    const changeApplied = verifyGroup.collapsed === targetCollapsed;
    
    if (changeApplied) {
      await chrome.tabGroups.update(testGroup.id, { collapsed: originalCollapsed });
    }
    
    collapseDetectionAttempted = true;
    
    if (cachedCapabilities) {
      cachedCapabilities.supportsGroupCollapse = changeApplied;
    } else {
      cachedCapabilities = {
        vendor: 'unknown',
        supportsGroupCollapse: changeApplied,
        supportsSingleTabGroups: null
      };
    }
    
    return changeApplied;
  } catch (error) {
    console.warn('[Browser] Could not detect group collapse support:', error);
    collapseDetectionAttempted = true;
    return true;
  }
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

export function setGroupCollapseSupport(supported: boolean): void {
  if (cachedCapabilities) {
    cachedCapabilities.supportsGroupCollapse = supported;
  } else {
    cachedCapabilities = {
      vendor: 'unknown',
      supportsGroupCollapse: supported,
      supportsSingleTabGroups: null
    };
  }
}

export function getCachedCapabilities(): BrowserCapabilities | null {
  return cachedCapabilities;
}

export function resetCapabilitiesCache(): void {
  cachedCapabilities = null;
  collapseDetectionAttempted = false;
}

export function needsCompanionTabForSingleTabGroup(): boolean {
  const cached = getCachedCapabilities();
  if (cached && cached.supportsSingleTabGroups !== null) {
    return !cached.supportsSingleTabGroups;
  }
  return false;
}
