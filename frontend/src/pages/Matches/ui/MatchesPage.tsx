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
      <main className="flex flex-1 flex-col items-center justify-center bg-secondary/10 p-6 text-center md:p-8">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 md:mb-6 md:h-20 md:w-20">
          <HeartHandshake className="size-8 text-primary md:size-10" strokeWidth={2.1} />
        </div>

        <h1 className="mb-2 text-2xl font-bold md:mb-3 md:text-3xl">{t("match.empty_title")}</h1>
        <p className="mb-6 max-w-md text-sm text-muted-foreground md:mb-8 md:text-base">
          {t("match.empty_description")}
        </p>

        <Button
          size="lg"
          className="h-12 rounded-2xl px-6 text-sm font-semibold md:h-14 md:px-8 md:text-base"
          onClick={() => navigate("/discovery")}
        >
          {t("chat.back_to_discovery")}
        </Button>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <main className="mx-auto max-w-400 p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="columns-2 gap-3 space-y-3 sm:gap-4 sm:space-y-4 md:columns-3 md:gap-6 md:space-y-6 lg:columns-4 xl:columns-5">
          {data?.matches.map((match) => (
            <button
              key={match.matchId}
              type="button"
              className="group relative block w-full cursor-pointer break-inside-avoid overflow-hidden rounded-xl bg-gray-100 text-left md:rounded-2xl"
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
              {/* градиент */}
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

              {/* текст */}
              <div className="absolute bottom-0 left-0 right-0 translate-y-1 p-3 text-white transition-transform duration-300 group-hover:translate-y-0 sm:p-4 md:p-5">
                <div className="mb-1 flex items-baseline gap-2">
                  <h2 className="text-base font-bold tracking-tight sm:text-lg md:text-xl lg:text-2xl">
                    {match.displayName}
                  </h2>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
