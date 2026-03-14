import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Coffee, ShieldAlert } from "lucide-react";

import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { Header } from "@/features/navigation/ui/Header";
import { DiscoveryProfileCard } from "./DiscoveryProfileCard";
import { Button } from "@/shared/components/ui/button";
import { useIsMobile } from "@/shared/hooks/use-mobile";

export default function DiscoveryPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    currentProfile,
    likeCurrentProfile,
    passCurrentProfile,
    resetDiscovery,
  } = useMatchmakingFlow();
  const [showReport, setShowReport] = useState(false);

  const handleLike = () => {
    const result = likeCurrentProfile();
    if (result.isMatch) {
      window.setTimeout(() => navigate("/match"), 300);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <Header />

      {!currentProfile ? (
        <main className="flex flex-1 flex-col items-center justify-center bg-secondary/20 p-8 text-center">
          <div className="mb-8 flex h-32 w-32 items-center justify-center rounded-full border border-border bg-card shadow-sm">
            <Coffee className="size-12 text-muted-foreground" />
          </div>
          <h2 className="mb-4 text-3xl font-bold">На сегодня всё</h2>
          <p className="mb-8 max-w-md text-lg text-muted-foreground">
            Мы анализируем новые данные о вашем образе жизни, чтобы подобрать
            идеальные совпадения.
          </p>
          <Button
            size="lg"
            variant="outline"
            className="rounded-2xl"
            onClick={resetDiscovery}
          >
            Обновить рекомендации
          </Button>
        </main>
      ) : (
        <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-secondary/20 p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentProfile.id}-${isMobile ? "mobile" : "desktop"}`}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -100, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-5xl"
            >
              <DiscoveryProfileCard
                profile={currentProfile}
                isMobile={isMobile}
                onPass={passCurrentProfile}
                onLike={handleLike}
                onOpenReport={() => setShowReport(true)}
              />
            </motion.div>
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
                    <h3 className="text-2xl font-bold">Безопасность</h3>
                  </div>

                  <p className="mb-8 text-muted-foreground">
                    Мы следим за тем, чтобы общение было комфортным. Выберите
                    действие для этого профиля.
                  </p>

                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="h-14 w-full justify-start rounded-2xl text-left text-base"
                      onClick={() => {
                        setShowReport(false);
                        passCurrentProfile();
                      }}
                    >
                      Больше не показывать
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 w-full justify-start rounded-2xl text-left text-base text-destructive hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setShowReport(false);
                        passCurrentProfile();
                      }}
                    >
                      Пожаловаться на профиль
                    </Button>
                    <Button
                      variant="ghost"
                      className="mt-4 h-14 w-full rounded-2xl text-base"
                      onClick={() => setShowReport(false)}
                    >
                      Отмена
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}
    </div>
  );
}
