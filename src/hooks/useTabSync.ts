import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { REFRESH_TABS_DEBOUNCE_MS } from '../constants';

export const useTabSync = () => {

  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRefresh = useRef(false);

  useEffect(() => {
    // Initial fetch
    useStore.getState().syncLiveTabs();

    // Listen for updates from background script
    const listener = (message: { type: string }) => {
      if (message.type === 'REFRESH_TABS') {
        const { isUpdating, syncLiveTabs } = useStore.getState();

        if (isUpdating) {
          // If already pending a refresh, don't schedule another
          if (pendingRefresh.current) return;

          // Mark that we have a pending refresh and debounce
          pendingRefresh.current = true;
          if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
          refreshTimeout.current = setTimeout(() => {
            pendingRefresh.current = false;
            syncLiveTabs();
          }, REFRESH_TABS_DEBOUNCE_MS);
        } else {
          syncLiveTabs();
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    
    // Also listen for local focus/visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        useStore.getState().syncLiveTabs();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    };
  }, []); // Empty dependency array ensures this only runs once
};
