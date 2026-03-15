import { useCallback, useEffect, useSyncExternalStore } from "react";

import { toMatchProfiles, type MatchProfile, type MatchProfileId } from "@/entities/match-profile/model";
import { getFeed, type FeedResponseDto } from "@/shared/api/feed";

export const FEED_QUERY_KEY = ["matchmaking", "feed"] as const;

export const FEED_REFRESH_EVENT = "feed:refresh";

export type MatchmakingFeed = FeedResponseDto & {
  profiles: MatchProfile[];
};

const PREFETCH_THRESHOLD = 5;

type FeedStore = {
  profiles: MatchProfile[];
  isLoading: boolean;
  isFetching: boolean;
  seenIds: Set<MatchProfileId>;
  initialLoadDone: boolean;
};

let store: FeedStore = {
  profiles: [],
  isLoading: true,
  isFetching: false,
  seenIds: new Set(),
  initialLoadDone: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  store = { ...store };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): FeedStore {
  return store;
}

async function fetchMore(limit: number) {
  if (store.isFetching) return;

  store.isFetching = true;
  emitChange();

  try {
    const feed = await getFeed(limit);
    const { cards } = feed;
    const newProfiles = toMatchProfiles(cards).filter(
      (p) => !store.seenIds.has(p.id),
    );

    for (const p of newProfiles) {
      store.seenIds.add(p.id);
    }

    store.profiles = [...store.profiles, ...newProfiles];
  } finally {
    store.isFetching = false;
    store.isLoading = false;
    emitChange();
  }
}

function refetchFeed(limit: number) {
  store.seenIds.clear();
  store.profiles = [];
  store.isLoading = true;
  emitChange();
  fetchMore(limit);
}

function removeProfile(id: MatchProfileId) {
  store.profiles = store.profiles.filter((p) => p.id !== id);
  emitChange();
}

export function resetFeedStore() {
  store = {
    profiles: [],
    isLoading: true,
    isFetching: false,
    seenIds: new Set(),
    initialLoadDone: false,
  };
  emitChange();
}

export function useFeed(limit = 20) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    if (!store.initialLoadDone) {
      store.initialLoadDone = true;
      fetchMore(limit);
    }
  }, [limit]);

  useEffect(() => {
    const handler = () => refetchFeed(limit);
    window.addEventListener(FEED_REFRESH_EVENT, handler);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, handler);
  }, [limit]);

  const notifyVisible = useCallback(
    (remainingCount: number) => {
      if (remainingCount <= PREFETCH_THRESHOLD) {
        fetchMore(limit);
      }
    },
    [limit],
  );

  return {
    profiles: snapshot.profiles,
    isLoading: snapshot.isLoading,
    notifyVisible,
    removeProfile,
    refetchFeed: () => refetchFeed(limit),
  };
}
