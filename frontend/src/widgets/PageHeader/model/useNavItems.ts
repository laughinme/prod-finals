import { useTranslation } from "react-i18next";
import { MessageCircle, Sparkles, Users, LucideIcon } from "lucide-react";
import { useMatches } from "@/features/match";
import { useMatchNotifications } from "@/app/providers/realtime";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: number | null;
}

export function useNavItems(): NavItem[] {
  const { t } = useTranslation();
  const { data: matchesResponse } = useMatches();
  const matchNotifications = useMatchNotifications();

  const unreadMessagesCount =
    matchesResponse?.matches.reduce(
      (total, match) => total + match.unreadCount,
      0,
    ) ?? 0;

  return [
    {
      label: t("common.discovery"),
      to: "/discovery",
      icon: Sparkles,
    },
    {
      label: t("common.messages"),
      to: "/chat",
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
    },
    {
      label: t("common.matches"),
      to: "/matches",
      icon: Users,
      badge:
        (matchNotifications?.unseenMatchCount ?? 0) > 0
          ? matchNotifications?.unseenMatchCount
          : null,
    },
  ];
}
