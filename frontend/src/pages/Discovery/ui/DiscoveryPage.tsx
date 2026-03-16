import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Coffee, ShieldAlert } from "lucide-react";

import { SwipeableCard } from "@/features/matchmaking";
import { MatchProfileCard } from "@/entities/match-profile/ui";
import { useDiscoveryPage } from "@/pages/Discovery/model";

import { useIsMobile } from "@/shared/hooks/use-mobile";

const noop = () => {};

export default function DiscoveryPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  // Lock vertical scrolling on mobile for this page
  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile]);

  const {
    currentProfile,
    nextProfiles,
    isFeedLoading,
    exitX,
    showReport,
    openReport,
    closeReport,
    handleLike,
    handlePass,
    handlePrepareTestMatch,
    handleBlock,
    handleReport,
    isSafetyPending,
    isPreparingTestMatch,
  } = useDiscoveryPage();

  return (
    <main className="relative flex h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden bg-secondary/20 p-0 md:h-[calc(100dvh-5rem)] md:p-8">
      <AnimatePresence initial={false}>
        {isFeedLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center p-8 text-center"
          >
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground">{t("common.loading_scenario")}</p>
          </motion.div>
        ) : !currentProfile ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center p-8 text-center"
          >
            <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <Coffee className="size-12 text-muted-foreground" />
            </div>
            <h2 className="mb-4 text-3xl font-bold">
              {t("discovery.no_more_today")}
            </h2>
            <p className="mb-8 max-w-md text-lg text-muted-foreground">
              {t("discovery.analyzing_habits")}
            </p>
          </motion.div>
        ) : (
          <>
            {nextProfiles.map((profile, idx) => {
              const depth = idx + 1;
              return (
                <div
                  key={`stack-${profile.id}`}
                  className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center px-2 md:px-8"
                  style={{
                    zIndex: 10 - depth,
                  }}
                >
                <div
                  className="w-full max-w-5xl overflow-hidden rounded-4xl"
                  style={{
                    transform: isMobile
                      ? `translateY(${depth * 8}px) scale(${1 - depth * 0.02})`
                      : `translateY(${depth * -24}px) scale(${1 - depth * 0.03})`,
                    transition: "transform 0.35s ease-out",
                  }}
                >
                  <MatchProfileCard
                    profile={profile}
                    isMobile={isMobile}
                    onLike={noop}
                    onPass={noop}
                    onOpenReport={noop}
                    showMatchScore={false}
                    showReportButton={false}
                    showActions={false}
                  />
                </div>
                </div>
              );
            })}

            <SwipeableCard
              key={`${currentProfile.id}-${isMobile ? "mobile" : "desktop"}`}
              profile={currentProfile}
              isMobile={isMobile}
              onLike={() => void handleLike()}
              onPass={() => void handlePass()}
              onOpenReport={openReport}
              onPrepareTestMatch={() => void handlePrepareTestMatch()}
              isPreparingTestMatch={isPreparingTestMatch}
              exitX={exitX}
            />
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-xs md:items-center"
            onClick={closeReport}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-xs rounded-2xl bg-card p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-2.5">
                <ShieldAlert className="size-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{t("discovery.safety")}</h3>
              </div>

              <div className="space-y-2">
                <button
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                  onClick={() => void handleBlock()}
                  disabled={isSafetyPending}
                >
                  {t("discovery.dont_show_again")}
                </button>
                <button
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                  onClick={() => void handleReport()}
                  disabled={isSafetyPending}
                >
                  {t("discovery.report_profile")}
                </button>
              </div>

              <button
                className="mt-3 w-full rounded-xl py-2.5 text-center text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                onClick={closeReport}
                disabled={isSafetyPending}
              >
                {t("common.cancel")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
