import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { toMatchListItems, type MatchListItem } from "@/entities/match/model";
import { getMatches, type MatchListResponseDto } from "@/shared/api/matches";

export const MATCHES_QUERY_KEY = ["matchmaking", "matches"] as const;

export type MatchmakingMatches = MatchListResponseDto & {
  matches: MatchListItem[];
};

export function useMatches(): UseQueryResult<MatchmakingMatches> {
  return useQuery({
    queryKey: MATCHES_QUERY_KEY,
    queryFn: async () => {
      const matches = await getMatches();

      return {
        ...matches,
        matches: toMatchListItems(matches.items),
      };
    },
  });
}
