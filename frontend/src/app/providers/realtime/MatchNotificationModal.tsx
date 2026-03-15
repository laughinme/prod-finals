import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { HeartHandshake, MessageCircle } from "lucide-react";

import type { MatchNotification } from "./context";
import { Button } from "@/shared/components/ui/button";

type MatchNotificationModalProps = {
  notification: MatchNotification | null;
  onLater: () => void;
  onWrite: () => void;
};

export function MatchNotificationModal({
  notification,
  onLater,
  onWrite,
}: MatchNotificationModalProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {notification ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-rose-100 via-background to-amber-100 p-8 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.18),_transparent_45%)]" />
              <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <HeartHandshake className="size-8" />
              </div>
              <h2 className="mb-3 text-3xl font-bold tracking-tight">{t("match.its_a_match")}</h2>
              <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                {t("match.match_description", { name: notification.peer.displayName })}
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6 flex items-center gap-4 rounded-3xl border border-border bg-secondary/40 p-4">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-secondary">
                  {notification.peer.avatarUrl ? (
                    <img
                      src={notification.peer.avatarUrl}
                      alt={notification.peer.displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {notification.peer.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-lg font-semibold">{notification.peer.displayName}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("match.realtime_match_hint")}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-12 flex-1 rounded-2xl"
                  onClick={onLater}
                >
                  {t("match.maybe_later")}
                </Button>
                <Button className="h-12 flex-1 rounded-2xl" onClick={onWrite}>
                  <MessageCircle className="size-4" />
                  {t("match.write_message")}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
