import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

import { deleteBlock } from "@/shared/api/safety";
import { BLOCKED_USERS_QUERY_KEY } from "./useBlockedUsers";

export function useUnblockUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId: string) => deleteBlock(targetUserId),
    onSuccess: async () => {
      toast.success(t("safety.unblock_success"));
      await queryClient.invalidateQueries({ queryKey: BLOCKED_USERS_QUERY_KEY });
    },
    onError: (error) => {
      Sentry.captureException(error);
      toast.error(t("safety.unblock_error"));
    },
  });
}
