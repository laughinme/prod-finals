import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Coffee, ShieldAlert } from "lucide-react";

import { SwipeableCard } from "@/features/matchmaking";
import { useDiscoveryPage } from "@/pages/Discovery/model";
import { Button } from "@/shared/components/ui/button";
import { useIsMobile } from "@/shared/hooks/use-mobile";

export default function DiscoveryPage() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const {
    currentProfile,
    exitX,
    showReport,
    openReport,
    closeReport,
    handleLike,
    handlePass,
    resetDiscovery,
  } = useDiscoveryPage();

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-secondary/20 p-4 md:p-8">
      <AnimatePresence initial={false}>
        {!currentProfile ? (
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
            <h2 className="mb-4 text-3xl font-bold">{t("discovery.no_more_today")}</h2>
            <p className="mb-8 max-w-md text-lg text-muted-foreground">
              {t("discovery.analyzing_habits")}
            </p>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl"
              onClick={resetDiscovery}
            >
              {t("discovery.refresh_recommendations")}
            </Button>
          </motion.div>
        ) : (
          <SwipeableCard
            key={`${currentProfile.id}-${isMobile ? "mobile" : "desktop"}`}
            profile={currentProfile}
            isMobile={isMobile}
            onLike={() => void handleLike()}
            onPass={() => void handlePass()}
            onOpenReport={openReport}
            exitX={exitX}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-destructive/10 p-3">
                  <ShieldAlert className="size-6 text-destructive" />
                </div>
                <h3 className="text-2xl font-bold">{t("discovery.safety")}</h3>
              </div>

              <p className="mb-8 text-muted-foreground">
                {t("discovery.safety_description")}
              </p>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="h-14 w-full justify-start rounded-2xl text-left text-base"
                  onClick={() => {
                    closeReport();
                    void handlePass();
                  }}
                >
                  {t("discovery.dont_show_again")}
                </Button>
                <Button
                  variant="outline"
                  className="h-14 w-full justify-start rounded-2xl text-left text-base text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    closeReport();
                    void handlePass();
                  }}
                >
                  {t("discovery.report_profile")}
                </Button>
                <Button
                  variant="ghost"
                  className="mt-4 h-14 w-full rounded-2xl text-base"
                  onClick={closeReport}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
