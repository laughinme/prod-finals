import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import {
  toMatchProfileExplanation,
  type MatchProfileExplanation,
} from "@/entities/match-profile/model";
import { getFeedItemExplanation } from "@/shared/api/feed";

export const FEED_EXPLANATION_QUERY_KEY = [
  "matchmaking",
  "feed",
  "explanation",
] as const;

export function useFeedExplanation(
  serveItemId: string | null,
): UseQueryResult<MatchProfileExplanation> {
  const { t } = useTranslation();

  return useQuery({
    queryKey: [...FEED_EXPLANATION_QUERY_KEY, serveItemId],
    enabled: Boolean(serveItemId),
    queryFn: async () => {
      if (!serveItemId) {
        throw new Error(t("errors.failed_to_get_explanation"));
      }

      const explanation = await getFeedItemExplanation(serveItemId);
      return toMatchProfileExplanation(explanation);
    },
  });
}
