import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { toMatchProfiles, type MatchProfile } from "@/entities/match-profile/model";
import { getFeed, type FeedResponseDto } from "@/shared/api/feed";

export const FEED_QUERY_KEY = ["matchmaking", "feed"] as const;

export type MatchmakingFeed = FeedResponseDto & {
  profiles: MatchProfile[];
};

export function useFeed(limit = 20): UseQueryResult<MatchmakingFeed> {
  return useQuery({
    queryKey: [...FEED_QUERY_KEY, limit],
    queryFn: async () => {
      const feed = await getFeed(limit);

      return {
        ...feed,
        profiles: toMatchProfiles(feed.cards),
      };
    },
  });
}
