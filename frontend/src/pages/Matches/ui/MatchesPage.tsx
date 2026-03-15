import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { format } from "date-fns";

import { useMatches } from "@/features/match/model/useMatches";
import { useMatchNotifications } from "@/app/providers/realtime";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function MatchesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useMatches();
  const matchNotifications = useMatchNotifications();

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("common.matches")}</h1>
        <p className="text-muted-foreground">
          {t("chat.no_active_chats_description")}
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden border-border bg-card">
              <CardContent className="p-0">
                <div className="aspect-square w-full">
                  <Skeleton className="h-full w-full rounded-none" />
                </div>
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.matches.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed text-center p-8">
          <MessageCircle className="mb-4 size-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-xl font-semibold">{t("chat.no_active_chats")}</h2>
          <p className="text-muted-foreground max-w-sm">
            {t("chat.no_active_chats_description")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.matches.map((match) => (
            <Card 
              key={match.matchId} 
              className="group cursor-pointer overflow-hidden border-border bg-card transition-colors hover:border-primary/50"
              onClick={() => {
                void matchNotifications?.markMatchAsSeen(match.matchId);
                navigate(`/chat?match=${match.matchId}`);
              }}
            >
              <CardContent className="p-0 relative">
                <div className="aspect-square w-full bg-secondary">
                  <img
                    src={match.avatarUrl || `https://api.dicebear.com/9.x/notionists/svg?seed=${match.candidateUserId}`}
                    alt={match.displayName}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {match.unreadCount > 0 && (
                  <Badge 
                    className="absolute top-3 right-3 rounded-full px-2"
                    variant="default"
                  >
                    {match.unreadCount} new
                  </Badge>
                )}
                {matchNotifications?.unseenMatchIds.includes(match.matchId) ? (
                  <Badge
                    className="absolute top-3 left-3 rounded-full px-2"
                    variant="secondary"
                  >
                    {t("match.new_match_badge")}
                  </Badge>
                ) : null}
                <div className="p-4 bg-card/95 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-lg line-clamp-1">{match.displayName}</h3>
                    {match.lastMessageAt && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {format(new Date(match.lastMessageAt), "MMM d")}
                      </span>
                    )}
                  </div>
                  {match.lastMessagePreview ? (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {match.lastMessagePreview}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {t("match.write_message")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
