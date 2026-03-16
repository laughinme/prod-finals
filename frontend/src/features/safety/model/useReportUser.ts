import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

import { postReport } from "@/shared/api/safety";
import type { ReportUserPayload } from "@/entities/safety";

export function useReportUser() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ReportUserPayload) => postReport(payload),
    onSuccess: () => {
      toast.success(t("safety.report_sent_success"));
    },
    onError: (error) => {
      Sentry.captureException(error);
      toast.error(t("safety.report_error"));
    },
  });
}
