import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MessageNotification } from "./context";
import { Button } from "@/shared/components/ui/button";

type MessageNotificationToastProps = {
  notification: MessageNotification | null;
  onDismiss: () => void;
  onOpen: () => void;
};

export function MessageNotificationToast({
  notification,
  onDismiss,
  onOpen,
}: MessageNotificationToastProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {notification ? (
        <motion.div
          initial={{ opacity: 0, y: -16, x: 12 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -12, x: 12 }}
          className="pointer-events-none fixed top-20 right-4 z-[95] w-full max-w-sm"
        >
          <div className="pointer-events-auto overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-start gap-3 p-4">
              <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle className="size-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {t("chat.new_message_title", {
                        name: notification.sender.displayName,
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("chat.new_message_hint")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    onClick={onDismiss}
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="mb-3 line-clamp-2 rounded-2xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
                  {notification.text}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-10 flex-1 rounded-2xl"
                    onClick={onDismiss}
                  >
                    {t("common.later")}
                  </Button>
                  <Button className="h-10 flex-1 rounded-2xl" onClick={onOpen}>
                    {t("chat.open_message")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
