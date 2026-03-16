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
  return (
    <AnimatePresence>
      {notification ? (
        <motion.div
          initial={{ opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 80 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-1.5 right-4 z-100 w-full max-w-sm"
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
