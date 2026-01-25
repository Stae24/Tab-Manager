import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export const useTabSync = () => {
  const refreshTimeout = useRef<any>(null);
  const pendingRefresh = useRef(false);

  useEffect(() => {
    // Initial fetch
    useStore.getState().syncLiveTabs();

    // Listen for updates from background script
    const listener = (message: any) => {
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
          }, 200);
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
