import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export const useTabSync = () => {
  const refreshTimeout = useRef<any>(null);

  useEffect(() => {
    // Initial fetch
    useStore.getState().refreshTabs();

    // Listen for updates from background script
    const listener = (message: any) => {
      if (message.type === 'REFRESH_TABS') {
        const { isUpdating, refreshTabs } = useStore.getState();
        if (isUpdating) {
          // If we are currently performing a manual update (like DND),
          // debounce the background refresh to prevent race conditions.
          if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
          refreshTimeout.current = setTimeout(() => {
            refreshTabs();
          }, 500);
        } else {
          refreshTabs();
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    
    // Also listen for local focus/visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        useStore.getState().refreshTabs();
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
