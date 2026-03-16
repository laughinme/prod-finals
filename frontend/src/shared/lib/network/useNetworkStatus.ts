import { useSyncExternalStore } from "react";

type NetworkStatusState = {
  isOnline: boolean;
  requiresReload: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

function getBrowserOnlineState(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.navigator.onLine;
}

let state: NetworkStatusState = {
  isOnline: getBrowserOnlineState(),
  requiresReload: !getBrowserOnlineState(),
};

let listenersInitialized = false;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(nextState: NetworkStatusState) {
  if (
    state.isOnline === nextState.isOnline &&
    state.requiresReload === nextState.requiresReload
  ) {
    return;
  }

  state = nextState;
  emitChange();
}

function syncWithNavigator() {
  const isOnline = getBrowserOnlineState();

  setState({
    isOnline,
    requiresReload: state.requiresReload || !isOnline,
  });
}

function ensureListeners() {
  if (listenersInitialized || typeof window === "undefined") {
    return;
  }

  listenersInitialized = true;
  syncWithNavigator();
  window.addEventListener("online", syncWithNavigator);
  window.addEventListener("offline", syncWithNavigator);
}

function subscribe(listener: Listener) {
  ensureListeners();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): NetworkStatusState {
  ensureListeners();
  return state;
}

export function markNetworkRecoveryRequired() {
  setState({
    isOnline: getBrowserOnlineState(),
    requiresReload: true,
  });
}

export function useNetworkStatus() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...snapshot,
    isOffline: !snapshot.isOnline,
    isBlockingConnectionIssue: !snapshot.isOnline || snapshot.requiresReload,
  };
}
