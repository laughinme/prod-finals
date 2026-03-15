import { useCallback, useEffect, useRef, useState } from "react";

import { toMatchProfiles, type MatchProfile, type MatchProfileId } from "@/entities/match-profile/model";
import { getFeed, type FeedResponseDto } from "@/shared/api/feed";

export const FEED_QUERY_KEY = ["matchmaking", "feed"] as const;

export const FEED_REFRESH_EVENT = "feed:refresh";

export type MatchmakingFeed = FeedResponseDto & {
  profiles: MatchProfile[];
};

const PREFETCH_THRESHOLD = 5;

export function useFeed(limit = 20) {
  const [profiles, setProfiles] = useState<MatchProfile[]>([]);
  const [feedMeta, setFeedMeta] = useState<Omit<FeedResponseDto, "cards"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFetchingRef = useRef(false);
  const seenIdsRef = useRef(new Set<MatchProfileId>());
  const initialLoadDone = useRef(false);

  const fetchMore = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const feed = await getFeed(limit);
      const { cards, ...meta } = feed;
      const newProfiles = toMatchProfiles(cards).filter(
        (p) => !seenIdsRef.current.has(p.id),
      );

      for (const p of newProfiles) {
        seenIdsRef.current.add(p.id);
      }

      setFeedMeta(meta);
      setProfiles((prev) => [...prev, ...newProfiles]);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [limit]);

  const refetchFeed = useCallback(() => {
    seenIdsRef.current.clear();
    setProfiles([]);
    setIsLoading(true);
    fetchMore();
  }, [fetchMore]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchMore();
    }
  }, [fetchMore]);

  useEffect(() => {
    const handler = () => refetchFeed();
    window.addEventListener(FEED_REFRESH_EVENT, handler);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, handler);
  }, [refetchFeed]);

  const notifyVisible = useCallback(
    (remainingCount: number) => {
      if (remainingCount <= PREFETCH_THRESHOLD) {
        fetchMore();
      }
    },
    [fetchMore],
  );

  const removeProfile = useCallback((id: MatchProfileId) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    profiles,
    feedMeta,
    isLoading,
    notifyVisible,
    removeProfile,
    refetchFeed,
  };
}
