import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { REFRESH_TABS_DEBOUNCE_MS } from '../constants';

const OPERATION_TIMEOUT_MS = 5000;

export const useTabSync = () => {
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRefresh = useRef(false);
  const operationTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const pendingOperations = useStore(state => state.pendingOperations);

  const clearOperationTimeout = (id: number) => {
    const timeout = operationTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      operationTimeouts.current.delete(id);
    }
  };

  useEffect(() => {
    useStore.getState().syncLiveTabs();

    const listener = (message: { type: string; tabId?: number; groupId?: number }) => {
      if (message.type === 'TAB_MOVED' && message.tabId !== undefined) {
        const { removePendingOperation } = useStore.getState();
        clearOperationTimeout(message.tabId);
        removePendingOperation(message.tabId);
        return;
      }

      if (message.type === 'GROUP_MOVED' && message.groupId !== undefined) {
        const { removePendingOperation } = useStore.getState();
        clearOperationTimeout(message.groupId);
        removePendingOperation(message.groupId);
        return;
      }

      if (message.type === 'REFRESH_TABS') {
        const { isUpdating, hasPendingOperations, syncLiveTabs } = useStore.getState();

        if (isUpdating || hasPendingOperations()) {
          if (pendingRefresh.current) return;

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
      operationTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      operationTimeouts.current.clear();
    };
  }, []);

  useEffect(() => {
    const currentIds = new Set(pendingOperations);
    const trackedIds = new Set(operationTimeouts.current.keys());

    currentIds.forEach((id) => {
      if (!operationTimeouts.current.has(id)) {
        const timeout = setTimeout(() => {
          const { removePendingOperation, hasPendingOperations } = useStore.getState();
          removePendingOperation(id);
          if (!hasPendingOperations()) {
            useStore.getState().syncLiveTabs();
          }
        }, OPERATION_TIMEOUT_MS);
        operationTimeouts.current.set(id, timeout);
      }
    });

    trackedIds.forEach((id) => {
      if (!currentIds.has(id)) {
        clearOperationTimeout(id);
      }
    });
  }, [pendingOperations]);
};
