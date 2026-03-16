import { useTranslation } from "react-i18next";
import { Heart, HeartHandshake, MessageCircle, X } from "lucide-react";

import type { PersonalNotification } from "./context";
import { cn } from "@/shared/lib/utils";

type MatchNotificationCardProps = {
  notification: PersonalNotification;
  onLater: () => void;
  onOpen: () => void;
  className?: string;
};

export function MatchNotificationCard({
  notification,
  onLater,
  onOpen,
  className,
}: MatchNotificationCardProps) {
  const { t } = useTranslation();
  const title =
    notification.kind === "match"
      ? t("match.new_match_toast")
      : notification.kind === "like"
        ? t("discovery.like_notification_title")
        : t("chat.message_notification_title");
  const subtitle =
    notification.kind === "message"
      ? notification.previewText
      : notification.peer.displayName;
  const Icon =
    notification.kind === "match"
      ? HeartHandshake
      : notification.kind === "like"
        ? Heart
        : MessageCircle;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg cursor-pointer transition-colors hover:bg-accent/50",
        className,
      )}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          {title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {subtitle}
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
