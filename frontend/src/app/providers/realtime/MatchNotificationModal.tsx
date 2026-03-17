import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { PersonalNotification } from "./context";
import { MatchNotificationCard } from "./MatchNotificationCard";

type MatchNotificationModalProps = {
  notification: PersonalNotification | null;
  onLater: () => void;
  onOpen: () => void;
};

export function MatchNotificationModal({
  notification,
  onLater,
  onOpen,
}: MatchNotificationModalProps) {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(onLater, 5000);
    return () => clearTimeout(timer);
  }, [notification?.notificationId]);

  return (
    <AnimatePresence mode="wait">
      {notification ? (
        <motion.div
          key={notification.notificationId}
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 80 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-16 right-3 z-100 w-full max-w-sm md:top-22 md:right-5"
        >
          <MatchNotificationCard
            notification={notification}
            onLater={onLater}
            onOpen={onOpen}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
