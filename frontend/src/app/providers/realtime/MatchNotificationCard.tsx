import { useTranslation } from "react-i18next";
import { HeartHandshake, X } from "lucide-react";

import type { MatchNotification } from "./context";
import { cn } from "@/shared/lib/utils";

type MatchNotificationCardProps = {
  notification: MatchNotification;
  onLater: () => void;
  onWrite: () => void;
  className?: string;
};

export function MatchNotificationCard({
  notification,
  onLater,
  onWrite,
  className,
}: MatchNotificationCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg cursor-pointer transition-colors hover:bg-accent/50",
        className,
      )}
      onClick={onWrite}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onWrite();
      }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <HeartHandshake className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {t("match.new_match_toast")}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {notification.peer.displayName}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onLater();
        }}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={t("common.close")}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
