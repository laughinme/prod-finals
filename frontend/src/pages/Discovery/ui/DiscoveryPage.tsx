import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Camera, Coffee, ShieldAlert, Wand2 } from "lucide-react";

import { SwipeableCard } from "@/features/matchmaking";
import { MatchProfileCard } from "@/entities/match-profile/ui";
import { useDiscoveryPage } from "@/pages/Discovery/model";

import { useIsMobile } from "@/shared/hooks/use-mobile";
import { Button } from "@/shared/components/ui/button";

const noop = () => {};

export default function DiscoveryPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    showPhotoGate,
    openReport,
    closeReport,
    closePhotoGate,
    handleLike,
    handlePass,
    handlePrepareTestMatch,
    handleBlock,
    handleReport,
    handleUseDefaultPhoto,
    handleUploadPhoto,
    isPhotoGatePending,
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
                  className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center px-4 md:px-8"
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

      <AnimatePresence>
        {showPhotoGate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm md:items-center"
            onClick={closePhotoGate}
          >
            <motion.div
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full max-w-md overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-2xl shadow-black/20"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="bg-[radial-gradient(circle_at_top,_rgba(255,221,45,0.22),_transparent_52%),linear-gradient(180deg,rgba(255,221,45,0.06),transparent)] px-6 pt-6 pb-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary/90">
                  <Wand2 className="size-4" />
                  {t("discovery.photo_gate_badge")}
                </div>
                <h3 className="mt-4 text-2xl font-black tracking-tight">
                  {t("discovery.photo_gate_title")}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {t("discovery.photo_gate_description")}
                </p>
              </div>

              <div className="space-y-3 px-6 py-5">
                <Button
                  type="button"
                  size="lg"
                  className="w-full rounded-2xl"
                  disabled={isPhotoGatePending}
                  onClick={() => void handleUseDefaultPhoto()}
                >
                  <Wand2 className="size-4.5" />
                  {t("profile.set_default_photo")}
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="w-full rounded-2xl"
                  disabled={isPhotoGatePending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="size-4.5" />
                  {t("profile.upload_photo")}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="w-full rounded-2xl"
                  disabled={isPhotoGatePending}
                  onClick={closePhotoGate}
                >
                  {t("discovery.photo_gate_skip")}
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleUploadPhoto(file);
                    }
                    event.target.value = "";
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
