import { useEffect } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { useNetworkStatus } from "@/shared/lib/network/useNetworkStatus";

export function OfflineBlocker() {
  const { t } = useTranslation();
  const { isOnline, isBlockingConnectionIssue } = useNetworkStatus();

  useEffect(() => {
    if (!isBlockingConnectionIssue) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isBlockingConnectionIssue]);

  if (!isBlockingConnectionIssue) {
    return null;
  }

  const title = isOnline
    ? t("common.connection_restored_reload_title")
    : t("common.offline_title");
  const description = isOnline
    ? t("common.connection_restored_reload_description")
    : t("common.offline_description");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-[32px] border border-white/12 bg-slate-950 px-6 py-8 text-white shadow-[0_28px_80px_rgba(15,23,42,0.55)] sm:px-8">
        <div className="mb-5 flex size-16 items-center justify-center rounded-3xl bg-white/8 text-amber-300">
          <WifiOff className="size-8" />
        </div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/90">
          {t("common.connection_problem_badge")}
        </p>
        <h1 className="mb-3 text-2xl font-semibold leading-tight sm:text-[2rem]">
          {title}
        </h1>
        <p className="mb-6 text-sm leading-6 text-slate-300 sm:text-base">
          {description}
        </p>
        <Button
          type="button"
          size="lg"
          className="h-12 w-full rounded-2xl text-sm font-semibold sm:h-14 sm:text-base"
          autoFocus
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="size-4.5" />
          {t("common.refresh_page")}
        </Button>
      </div>
    </div>
  );
}
