import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  toClosedMatchResult,
  type CloseMatchReasonCode,
  type ClosedMatchResult,
} from "@/entities/match/model";
import { postCloseMatch } from "@/shared/api/matches";

import { FEED_REFRESH_EVENT } from "@/features/matchmaking/model/useFeed";

import { MATCHES_QUERY_KEY } from "./useMatches";

export type CloseMatchVariables = {
  matchId: string;
  reasonCode: CloseMatchReasonCode;
};

export function useCloseMatch(): UseMutationResult<
  ClosedMatchResult,
  Error,
  CloseMatchVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["matchmaking", "matches", "close"],
    mutationFn: async (variables) => {
      const response = await postCloseMatch(variables.matchId, {
        reason_code: variables.reasonCode,
      });

      return toClosedMatchResult(response);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });

      if (result.removedFromFutureFeed) {
        window.dispatchEvent(new Event(FEED_REFRESH_EVENT));
      }
    },
  });
}
