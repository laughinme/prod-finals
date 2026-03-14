import { motion, useMotionValue, useTransform, animate } from "motion/react";
import { useDrag } from "@use-gesture/react";
import type { MatchProfile } from "@/entities/match-profile/model";
import { MatchProfileCard } from "@/entities/match-profile/ui";

interface SwipeableCardProps {
  profile: MatchProfile;
  isMobile: boolean;
  onLike: () => void;
  onPass: () => void;
  onOpenReport: () => void;
  exitX: number;
}

export function SwipeableCard({
  profile,
  isMobile,
  onLike,
  onPass,
  onOpenReport,
  exitX,
}: SwipeableCardProps) {
  const x = useMotionValue(0);

  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(
    x,
    [-200, -150, 0, 150, 200],
    [0.5, 1, 1, 1, 0.5],
  );

  const likeOpacity = useTransform(x, [50, 150], [0, 1]);
  const nopeOpacity = useTransform(x, [-150, -50], [1, 0]);

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx] }) => {
      if (active) {
        x.set(mx);
      } else {
        const threshold = 100;
        const swipeVelocity = 0.5;

        const isSwipeLike = mx > threshold || (vx > swipeVelocity && dx > 0);
        const isSwipePass = mx < -threshold || (vx > swipeVelocity && dx < 0);

        if (isSwipeLike) {
          onLike();
        } else if (isSwipePass) {
          onPass();
        } else {
          animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
        }
      }
    },
    {
      axis: "x",
      filterTaps: true,
      preventScroll: true,
    },
  );

  return (
    <motion.div
      {...(bind() as any)}
      style={{
        x,
        rotate,
        opacity,
        touchAction: "pan-y",
      }}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        x: exitX,
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.2 },
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      className="absolute inset-x-4 z-10 mx-auto w-auto max-w-5xl cursor-grab active:cursor-grabbing md:inset-x-8"
    >
      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute top-12 left-12 z-20 rounded-xl border-4 border-green-500 px-4 py-2 text-4xl font-black text-green-500 uppercase -rotate-15 md:top-20 md:left-20"
      >
        LIKE
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute top-12 right-12 z-20 rounded-xl border-4 border-red-500 px-4 py-2 text-4xl font-black text-red-500 uppercase rotate-15 md:top-20 md:right-20"
      >
        NOPE
      </motion.div>

      <MatchProfileCard
        profile={profile}
        isMobile={isMobile}
        onPass={onPass}
        onLike={onLike}
        onOpenReport={onOpenReport}
      />
    </motion.div>
  );
}
