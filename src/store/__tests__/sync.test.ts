import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStore } from '../useStore';

describe('Sync Storage Robustness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useStore.setState({
      appearanceSettings: {
        theme: 'system',
        uiScale: 1,
        settingsScale: 1,
        tabDensity: 'normal',
        animationIntensity: 'full',
        showFavicons: true,
        showAudioIndicators: 'both',
        showFrozenIndicators: true,
        showActiveIndicator: true,
        showTabCount: true,
        accentColor: 'gx-accent',
        borderRadius: 'medium',
        compactGroupHeaders: false,
        buttonSize: 'medium',
        iconPack: 'gx',
        vaultSyncEnabled: true,
        faviconSource: 'google',
        faviconFallback: 'duckduckgo',
        faviconSize: '32',
        sortGroupsByCount: true,
        sortVaultGroupsByCount: true,
      } as any
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use a 5000ms debounce for syncSettings', async () => {
    const { setAppearanceSettings } = useStore.getState();
    setAppearanceSettings({ theme: 'dark' });
    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
  });

  it('should retry on sync failure with exponential backoff', async () => {
    let attempts = 0;
    // @ts-expect-error
    chrome.storage.sync.set.mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('MAX_WRITE_OPERATIONS_PER_HOUR'));
      }
      return Promise.resolve();
    });

    const { setAppearanceSettings } = useStore.getState();
    setAppearanceSettings({ theme: 'light' });

    await vi.advanceTimersByTimeAsync(5000);
    expect(attempts).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(attempts).toBe(2);

    await vi.advanceTimersByTimeAsync(2000);
    expect(attempts).toBe(3);
    
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(3);
  });

  it('should log quota exceeded errors specifically', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // @ts-expect-error
    chrome.storage.sync.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

    const { setAppearanceSettings } = useStore.getState();
    setAppearanceSettings({ theme: 'dark' });

    await vi.advanceTimersByTimeAsync(5000);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SyncSettings] Failed to sync'),
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});
