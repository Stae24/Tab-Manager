import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectBrowser,
  initBrowserCapabilities,
  getBrowserCapabilities,
  getCachedCapabilities,
  resetCapabilitiesCache,
  needsCompanionTabForSingleTabGroup,
} from '../browser';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('browser utilities', () => {
  beforeEach(() => {
    resetCapabilitiesCache();
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (navigator as any).brave;
  });

  describe('detectBrowser', () => {
    const mockUserAgent = (ua: string) => {
      Object.defineProperty(navigator, 'userAgent', {
        value: ua,
        configurable: true,
      });
    };

    afterEach(() => {
      delete (navigator as any).brave;
    });

    it('should detect Brave via API', async () => {
      const nav = navigator as typeof navigator & { brave?: { isBrave: () => Promise<boolean> } };
      nav.brave = { isBrave: () => Promise.resolve(true) };

      const result = await detectBrowser();

      expect(result).toBe('brave');
    });

    it('should handle Brave API error gracefully', async () => {
      const nav = navigator as typeof navigator & { brave?: { isBrave: () => Promise<boolean> } };
      nav.brave = { isBrave: () => Promise.reject(new Error('Not available')) };
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      const result = await detectBrowser();

      expect(result).toBe('chrome');
    });

    it('should detect Edge', async () => {
      mockUserAgent('Mozilla/5.0 Edg/120.0.0.0');

      const result = await detectBrowser();

      expect(result).toBe('edge');
    });

    it('should detect Opera', async () => {
      mockUserAgent('Mozilla/5.0 OPR/120.0.0.0');

      const result = await detectBrowser();

      expect(result).toBe('opera');
    });

    it('should detect Firefox', async () => {
      mockUserAgent('Mozilla/5.0 Firefox/120.0');

      const result = await detectBrowser();

      expect(result).toBe('firefox');
    });

    it('should detect Chrome', async () => {
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      const result = await detectBrowser();

      expect(result).toBe('chrome');
    });

    it('should default to chrome for unknown', async () => {
      mockUserAgent('Mozilla/5.0 Unknown/1.0');

      const result = await detectBrowser();

      expect(result).toBe('chrome');
    });
  });

  describe('initBrowserCapabilities', () => {
    const mockUserAgent = (ua: string) => {
      Object.defineProperty(navigator, 'userAgent', {
        value: ua,
        configurable: true,
      });
    };

    it('should return cached capabilities on second call', async () => {
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      const result1 = await initBrowserCapabilities();
      const result2 = await initBrowserCapabilities();

      expect(result1).toBe(result2);
    });

    it('should return false for Firefox', async () => {
      mockUserAgent('Mozilla/5.0 Firefox/120.0');

      const result = await initBrowserCapabilities();

      expect(result).toBe(false);
    });

    it('should return true for Chrome', async () => {
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      const result = await initBrowserCapabilities();

      expect(result).toBe(true);
    });

    it('should set supportsSingleTabGroups to false for Opera', async () => {
      mockUserAgent('Mozilla/5.0 OPR/120.0.0.0');

      await initBrowserCapabilities();
      const caps = getCachedCapabilities();

      expect(caps?.supportsSingleTabGroups).toBe(false);
    });

    it('should set supportsSingleTabGroups to true for Chrome', async () => {
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      await initBrowserCapabilities();
      const caps = getCachedCapabilities();

      expect(caps?.supportsSingleTabGroups).toBe(true);
    });

    it('should log Brave detection', async () => {
      const nav = navigator as typeof navigator & { brave?: { isBrave: () => Promise<boolean> } };
      nav.brave = { isBrave: () => Promise.resolve(true) };
      const { logger } = await import('../logger');

      await initBrowserCapabilities();

      expect(logger.info).toHaveBeenCalledWith(
        '[initBrowserCapabilities] Brave detected - visual refresh workaround enabled'
      );
    });

    it('should return cached supportsGroupCollapse value', async () => {
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      const result1 = await initBrowserCapabilities();
      const caps = getCachedCapabilities();

      expect(caps?.supportsGroupCollapse).toBe(result1);
    });
  });

  describe('getBrowserCapabilities', () => {
    const mockUserAgent = (ua: string) => {
      Object.defineProperty(navigator, 'userAgent', {
        value: ua,
        configurable: true,
      });
    };

    it('should return capabilities after initialization', async () => {
      resetCapabilitiesCache();
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      const caps = await getBrowserCapabilities();

      expect(caps.vendor).toBe('chrome');
      expect(caps.supportsGroupCollapse).toBe(true);
      expect(caps.supportsSingleTabGroups).toBe(true);
    });

    it('should initialize if not cached', async () => {
      resetCapabilitiesCache();
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      expect(getCachedCapabilities()).toBeNull();

      const caps = await getBrowserCapabilities();

      expect(caps).not.toBeNull();
    });
  });

  describe('getCachedCapabilities', () => {
    it('should return null when not initialized', () => {
      expect(getCachedCapabilities()).toBeNull();
    });

    it('should return cached capabilities after initialization', async () => {
      await initBrowserCapabilities();

      expect(getCachedCapabilities()).not.toBeNull();
    });
  });

  describe('resetCapabilitiesCache', () => {
    it('should clear cached capabilities', async () => {
      await initBrowserCapabilities();
      expect(getCachedCapabilities()).not.toBeNull();

      resetCapabilitiesCache();

      expect(getCachedCapabilities()).toBeNull();
    });
  });

  describe('needsCompanionTabForSingleTabGroup', () => {
    const mockUserAgent = (ua: string) => {
      Object.defineProperty(navigator, 'userAgent', {
        value: ua,
        configurable: true,
      });
    };

    it('should return true for Opera', async () => {
      resetCapabilitiesCache();
      mockUserAgent('Mozilla/5.0 OPR/120.0.0.0');

      await initBrowserCapabilities();

      expect(needsCompanionTabForSingleTabGroup()).toBe(true);
    });

    it('should return false for Chrome', async () => {
      resetCapabilitiesCache();
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');

      await initBrowserCapabilities();

      expect(needsCompanionTabForSingleTabGroup()).toBe(false);
    });

    it('should return false when not initialized', () => {
      expect(needsCompanionTabForSingleTabGroup()).toBe(false);
    });

    it('should return false when supportsSingleTabGroups is null', async () => {
      resetCapabilitiesCache();
      mockUserAgent('Mozilla/5.0 Chrome/120.0.0.0');
      await initBrowserCapabilities();

      const caps = getCachedCapabilities();
      if (caps) {
        caps.supportsSingleTabGroups = null;
      }

      expect(needsCompanionTabForSingleTabGroup()).toBe(false);
    });
  });
});
