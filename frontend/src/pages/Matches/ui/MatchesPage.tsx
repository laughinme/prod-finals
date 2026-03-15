import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HeartHandshake } from "lucide-react";

import { useMatches } from "@/features/match/model/useMatches";
import { useMatchNotifications } from "@/app/providers/realtime";
import { Button } from "@/shared/components/ui/button";

export default function MatchesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useMatches();
  const matchNotifications = useMatchNotifications();

  if (isLoading) {
    return null;
  }

  if (data?.matches.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-secondary/10 p-8 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <HeartHandshake className="size-10 text-primary" strokeWidth={2.1} />
        </div>

        <h1 className="mb-3 text-3xl font-bold">{t("match.empty_title")}</h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          {t("match.empty_description")}
        </p>

        <Button
          size="lg"
          className="h-14 rounded-2xl px-8 text-base font-semibold"
          onClick={() => navigate("/discovery")}
        >
          {t("chat.back_to_discovery")}
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("common.matches")}</h1>

      <div className="columns-2 gap-4 space-y-4 md:columns-3 lg:columns-4 xl:columns-5 sm:gap-6 sm:space-y-6">
        {data?.matches.map((match) => (
          <button
            key={match.matchId}
            type="button"
            className="group relative mb-4 block w-full break-inside-avoid cursor-pointer overflow-hidden rounded-2xl bg-gray-100 text-left sm:mb-6"
            onClick={() => {
              void matchNotifications?.markMatchAsSeen(match.matchId);
              navigate(`/chat?match=${match.matchId}`, {
                state: {
                  matchId: match.matchId,
                  conversationId: match.conversationId,
                },
              });
            }}
          >
            <img
              src={match.avatarUrl}
              alt={match.displayName}
              className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
              referrerPolicy="no-referrer"
            />

            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="absolute right-0 bottom-0 left-0 p-4 text-white transition-transform duration-300 group-hover:translate-y-0 sm:p-5">
              <div className="mb-1 flex items-baseline gap-2">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                  {match.displayName}
                </h2>
              </div>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
