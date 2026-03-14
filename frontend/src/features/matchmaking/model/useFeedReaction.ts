import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import {
  toMatchProfileReaction,
  type MatchProfileReaction,
  type MatchProfileReactionAction,
} from "@/entities/match-profile/model";
import { postFeedReaction } from "@/shared/api/feed";

export type FeedReactionVariables = {
  serveItemId: string;
  action: MatchProfileReactionAction;
  openedExplanation: boolean;
  openedProfile: boolean;
  dwellTimeMs: number | null;
};

export function useFeedReaction(): UseMutationResult<
  MatchProfileReaction,
  Error,
  FeedReactionVariables
> {
  return useMutation({
    mutationKey: ["matchmaking", "feed", "reaction"],
    mutationFn: async (variables) => {
      const reaction = await postFeedReaction(variables.serveItemId, {
        action: variables.action,
        opened_explanation: variables.openedExplanation,
        opened_profile: variables.openedProfile,
        dwell_time_ms: variables.dwellTimeMs,
      });

      return toMatchProfileReaction(reaction);
    },
  });
}
