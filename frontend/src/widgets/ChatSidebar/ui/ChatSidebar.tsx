import { motion } from "motion/react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { IconUserCircle } from "@tabler/icons-react";
import type { MatchListItem } from "@/entities/match/model/types";

interface ChatSidebarProps {
  search: string;
  setSearch: (value: string) => void;
  visibleMatches: MatchListItem[];
  activeMatchId?: string;
  onSelectMatch: (matchId: string | null) => void;
}

export function ChatSidebar({
  search,
  setSearch,
  visibleMatches,
  activeMatchId,
  onSelectMatch,
}: ChatSidebarProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="border-b border-border p-3 md:p-4">
        <h2 className="mb-3 text-lg font-bold md:mb-4 md:text-xl">
          {t("chat.messages_title")}
        </h2>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("chat.search_placeholder")}
            className="w-full rounded-lg bg-secondary py-2 pr-4 pl-9 text-sm outline-none transition-all focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleMatches.map((match, index) => (
          <motion.button
            key={match.matchId}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02, duration: 0.15 }}
            onClick={() => onSelectMatch(match.matchId)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors",
              match.matchId === activeMatchId
                ? "bg-secondary/50"
                : "hover:bg-secondary/40",
            )}
          >
            <div className="relative h-11 w-11 shrink-0 md:h-12 md:w-12">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground/60">
                {match.avatarUrl ? (
                  <img
                    src={match.avatarUrl}
                    alt={match.displayName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <IconUserCircle className="size-8 md:size-9" />
                )}
              </div>
              <div className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="mb-1 flex items-baseline justify-between">
                <h3 className="truncate text-sm font-semibold">
                  {match.displayName}
                </h3>
                <div className="flex items-center gap-2">
                  {match.unreadCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {match.unreadCount}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {match.lastMessageAt
                      ? new Intl.DateTimeFormat("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(match.lastMessageAt))
                      : ""}
                  </span>
                </div>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {match.lastMessagePreview ?? t("chat.no_messages_yet")}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </>
  );
}
