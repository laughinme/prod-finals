import { motion, AnimatePresence } from "motion/react";
import type { MatchNotification } from "./context";
import { MatchNotificationCard } from "./MatchNotificationCard";

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
  return (
    <AnimatePresence>
      {notification ? (
        <motion.div
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 80 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-[6px] right-4 z-100 w-full max-w-sm"
        >
          <MatchNotificationCard
            notification={notification}
            onLater={onLater}
            onWrite={onWrite}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
