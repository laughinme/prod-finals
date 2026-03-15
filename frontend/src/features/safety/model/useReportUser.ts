import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { postReport, type ReportRequestDto } from "@/shared/api/report";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

export function useReportUser() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ReportRequestDto) => postReport(payload),
    onSuccess: () => {
      toast.success(t("safety.report_sent_success"));
    },
    onError: (error) => {
      Sentry.captureException(error);
      toast.error(t("safety.report_error"));
    },
  });
}
