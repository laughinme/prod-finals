import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

import {
  postFeedTestMatch,
  type FeedTestMatchResponseDto,
} from "@/shared/api/feed";

export type FeedTestMatchVariables = {
  serveItemId: string;
};

export function useFeedTestMatch(): UseMutationResult<
  FeedTestMatchResponseDto,
  Error,
  FeedTestMatchVariables
> {
  const { t } = useTranslation();

  return useMutation({
    mutationKey: ["matchmaking", "feed", "test-match"],
    mutationFn: async (variables) => postFeedTestMatch(variables.serveItemId),
    onSuccess: (response) => {
      toast.success(response.message || t("discovery.test_match_ready"));
    },
    onError: (error) => {
      Sentry.captureException(error);
      toast.error(t("discovery.test_match_error"));
    },
  });
}
