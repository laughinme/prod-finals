import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useMatches } from "@/features/match/model/useMatches";
import { useMatchNotifications } from "@/app/providers/realtime";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function MatchesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useMatches();
  const matchNotifications = useMatchNotifications();

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold tracking-tight">{t("common.matches")}</h1>

      {isLoading ? (
        <div className="columns-2 gap-4 space-y-4 md:columns-3 lg:columns-4 xl:columns-5 sm:gap-6 sm:space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="mb-4 break-inside-avoid overflow-hidden rounded-3xl sm:mb-6">
              <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
            </div>
          ))}
        </div>
      ) : data?.matches.length === 0 ? (
        <p className="py-16 text-center text-lg text-muted-foreground">
          Пока что тут пусто
        </p>
      ) : (
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
      )}
    </main>
  );
}
