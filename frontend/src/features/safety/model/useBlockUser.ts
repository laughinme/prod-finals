import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

import { postBlock } from "@/shared/api/safety";
import type { BlockUserPayload } from "@/entities/safety";

export function useBlockUser() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: BlockUserPayload) => postBlock(payload),
    onSuccess: () => {
      toast.success(t("safety.block_success"));
    },
    onError: (error) => {
      Sentry.captureException(error);
      toast.error(t("safety.block_error"));
    },
  });
}
