import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Heart, HeartHandshake, MessageCircle } from "lucide-react";

import { useMatchNotifications } from "@/app/providers/realtime/useMatchNotifications";
import type { PersonalNotification } from "@/app/providers/realtime/context";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";

type HeaderNotificationsBellProps = {
  compact?: boolean;
};

function getInitials(name: string) {
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: PersonalNotification;
  onOpen: (notification: PersonalNotification) => Promise<void>;
}) {
  const { t } = useTranslation();
  const isSeen = Boolean(notification.seenAt);

  const Icon =
    notification.kind === "match"
      ? HeartHandshake
      : notification.kind === "like"
        ? Heart
        : MessageCircle;

  const title =
    notification.kind === "match"
      ? t("match.new_match_badge")
      : notification.kind === "like"
        ? t("notifications.like_received")
        : t("notifications.message_received");

  const subtitle =
    notification.kind === "message"
      ? notification.previewText
      : notification.kind === "like"
        ? t("notifications.like_from", { name: notification.peer.displayName })
        : t("notifications.match_with", { name: notification.peer.displayName });

  return (
    <button
      type="button"
      onClick={() => void onOpen(notification)}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
        isSeen
          ? "border-transparent bg-muted/45 hover:bg-muted/75"
          : "border-primary/20 bg-primary/5 hover:bg-primary/10",
      )}
    >
      <div className="relative shrink-0">
        <Avatar size="lg" className="size-10 ring-1 ring-border">
          {notification.peer.avatarUrl ? (
            <AvatarImage src={notification.peer.avatarUrl} alt={notification.peer.displayName} />
          ) : null}
          <AvatarFallback>{getInitials(notification.peer.displayName)}</AvatarFallback>
        </Avatar>
        <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border">
          <Icon className="size-3.5" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {notification.peer.displayName}
            </p>
          </div>
          {!isSeen ? (
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
          ) : null}
        </div>

        <p className="mt-1 line-clamp-2 text-sm text-foreground/85">{subtitle}</p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {formatNotificationTime(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

export function HeaderNotificationsBell({
  compact = false,
}: HeaderNotificationsBellProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const notificationsState = useMatchNotifications();
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const notifications = notificationsState?.notifications ?? [];
  const totalUnseenCount = notificationsState?.totalUnseenCount ?? 0;
  const hasNotifications = notifications.length > 0;
  const displayCount = totalUnseenCount > 99 ? "99+" : String(totalUnseenCount);

  const groupedSummary = useMemo(() => {
    if (!notificationsState) {
      return null;
    }
    return {
      likes: notificationsState.unseenLikeCount,
      matches: notificationsState.unseenMatchCount,
      messages: notificationsState.unseenMessageCount,
    };
  }, [notificationsState]);

  const centerMobileDropdown = useCallback(() => {
    if (!compact || !isMobile || !open) {
      return;
    }

    const content = contentRef.current;
    const wrapper = content?.parentElement;

    if (!content || !wrapper) {
      return;
    }

    const { top, width } = wrapper.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const horizontalPadding = 8;
    const nextWidth = Math.min(width, viewportWidth - horizontalPadding * 2);
    const nextLeft = Math.max(
      horizontalPadding,
      (viewportWidth - nextWidth) / 2,
    );

    wrapper.style.left = `${nextLeft}px`;
    wrapper.style.top = `${Math.max(horizontalPadding, top)}px`;
    wrapper.style.transform = "none";
    wrapper.style.minWidth = "0";
  }, [compact, isMobile, open]);

  useEffect(() => {
    if (!compact || !isMobile || !open) {
      return;
    }

    const frameId = window.requestAnimationFrame(centerMobileDropdown);
    window.addEventListener("resize", centerMobileDropdown);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", centerMobileDropdown);
    };
  }, [centerMobileDropdown, compact, isMobile, open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative inline-flex items-center justify-center rounded-full border border-border bg-background/80 text-foreground ring-offset-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            compact ? "h-9 w-9" : "h-9 w-9",
          )}
          aria-label={t("notifications.open_inbox")}
        >
          <Bell className={cn(compact ? "size-4.5" : "size-4.5")} />
          {totalUnseenCount > 0 ? (
            <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
              {displayCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        ref={contentRef}
        align="end"
        collisionPadding={8}
        onPlaced={centerMobileDropdown}
        sideOffset={10}
        className="w-[calc(100vw-1rem)] max-w-[23rem] rounded-3xl border-border/70 p-0 shadow-2xl"
      >
        <div className="px-4 pt-4 pb-3">
          <DropdownMenuLabel className="px-0 py-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-foreground">
                  {t("notifications.title")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hasNotifications
                    ? t("notifications.subtitle")
                    : t("notifications.empty_subtitle")}
                </p>
              </div>
              {totalUnseenCount > 0 ? (
                <Badge className="rounded-full px-2.5 py-1 text-[11px]">
                  {t("notifications.unread_count", { count: totalUnseenCount })}
                </Badge>
              ) : null}
            </div>
          </DropdownMenuLabel>

          {groupedSummary ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full">
                {t("notifications.likes_short", { count: groupedSummary.likes })}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {t("notifications.matches_short", { count: groupedSummary.matches })}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {t("notifications.messages_short", { count: groupedSummary.messages })}
              </Badge>
            </div>
          ) : null}
        </div>

        <DropdownMenuSeparator />

        <div className="max-h-[28rem] space-y-2 overflow-y-auto px-3 py-3">
          {hasNotifications ? (
            notifications.map((notification) => (
              <NotificationRow
                key={notification.notificationId}
                notification={notification}
                onOpen={notificationsState?.openNotification ?? (async () => {})}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
              <Bell className="mx-auto size-5 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {t("notifications.empty_title")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("notifications.empty_body")}
              </p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
