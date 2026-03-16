import { useCallback, useEffect, useRef } from "react";
import { Heart, X } from "lucide-react";
import type { MatchProfile } from "@/entities/match-profile/model";
import { MatchProfileCard } from "@/entities/match-profile/ui";
import { useNetworkStatus } from "@/shared/lib/network/useNetworkStatus";
import { getPosition } from "./utils/get-position";
import { clamp } from "./utils/clamp";

interface SwipeableCardProps {
  profile: MatchProfile;
  isMobile: boolean;
  onLike: () => void | boolean | Promise<boolean | void>;
  onPass: () => void;
  onOpenReport: () => void;
  onPrepareTestMatch?: () => void;
  isPreparingTestMatch?: boolean;
  exitX: number;
}

export function SwipeableCard({
  profile,
  isMobile,
  onLike,
  onPass,
  onOpenReport,
  onPrepareTestMatch,
  isPreparingTestMatch = false,
}: SwipeableCardProps) {
  const { isBlockingConnectionIssue } = useNetworkStatus();
  const cardRef = useRef<HTMLDivElement>(null);
  const likeBadgeRef = useRef<HTMLDivElement>(null);
  const nopeBadgeRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{ x: number; y: number } | undefined>(
    undefined,
  );
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const passTimeoutRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);

  const setBadgeOpacity = useCallback((progress: number) => {
    const likeOpacity = clamp(progress, 0, 1);
    const nopeOpacity = clamp(-progress, 0, 1);

    if (likeBadgeRef.current) {
      likeBadgeRef.current.style.opacity = `${likeOpacity}`;
    }

    if (nopeBadgeRef.current) {
      nopeBadgeRef.current.style.opacity = `${nopeOpacity}`;
    }
  }, []);

  const resetCardPosition = useCallback((animated = true) => {
    const card = cardRef.current;
    if (!card) return;

    card.style.transition = animated ? "transform 0.25s ease-out" : "none";
    card.style.transform = "translate(0px, 0px) rotate(0deg)";
    card.style.willChange = "auto";
    progressRef.current = 0;
    setBadgeOpacity(0);
  }, [setBadgeOpacity]);

  const cancelInteraction = useCallback((animated = true) => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (passTimeoutRef.current !== null) {
      window.clearTimeout(passTimeoutRef.current);
      passTimeoutRef.current = null;
    }

    interactionRef.current = undefined;
    pendingPositionRef.current = null;
    resetCardPosition(animated);
  }, [resetCardPosition]);

  const handleStart = useCallback(
    (
      e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
    ) => {
      if (isBlockingConnectionIssue) {
        cancelInteraction(false);
        return;
      }

      const card = cardRef.current;
      if (!card) return;

      card.style.transition = "";
      card.style.willChange = "transform";

      const { x, y } = getPosition(e);
      interactionRef.current = { x, y };
    },
    [cancelInteraction, isBlockingConnectionIssue],
  );

  const handleMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (isBlockingConnectionIssue) {
      cancelInteraction();
      return;
    }

    if (!interactionRef.current) return;

    pendingPositionRef.current = getPosition(e);

    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;

      if (!interactionRef.current) return;
      const card = cardRef.current;
      const pendingPosition = pendingPositionRef.current;
      if (!card) return;
      if (!pendingPosition) return;

      const { x, y } = pendingPosition;
      const dx = (x - interactionRef.current.x) * 0.8;
      const dy = (y - interactionRef.current.y) * 0.5;
      const deg = (dx / 600) * -30;

      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${deg}deg)`;

      const nextProgress = clamp(dx / 100, -1, 1);
      progressRef.current = nextProgress;
      setBadgeOpacity(nextProgress);
    });
  }, [cancelInteraction, isBlockingConnectionIssue, setBadgeOpacity]);

  const handleEnd = useCallback(() => {
    if (isBlockingConnectionIssue) {
      cancelInteraction();
      return;
    }

    if (!interactionRef.current) return;
    const card = cardRef.current;
    if (!card) return;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const progress = progressRef.current;
    const isSelect = Math.abs(progress) === 1;
    const isGood = progress === 1;

    let currentX = 0;
    let currentY = 0;
    let currentRotate = 0;

    const transformStr = card.style.transform;
    const matchTranslateX = transformStr.match(/translate\(([^p]+)px/);
    if (matchTranslateX) currentX = parseFloat(matchTranslateX[1]);
    const matchTranslateY = transformStr.match(/px, ([^p]+)px\)/);
    if (matchTranslateY) currentY = parseFloat(matchTranslateY[1]);
    const matchRotate = transformStr.match(/rotate\(([^d]+)deg\)/);
    if (matchRotate) currentRotate = parseFloat(matchRotate[1]);

    interactionRef.current = undefined;
    pendingPositionRef.current = null;
    progressRef.current = 0;
    setBadgeOpacity(0);

    const animateCardOut = (direction: "left" | "right") => {
      const dx = direction === "right"
        ? window.innerWidth
        : (window.innerWidth + card.getBoundingClientRect().width) * -1;

      card.style.transition = "transform 0.3s ease-in-out";
      card.style.transform = `translate(${currentX + dx}px, ${currentY}px) rotate(${currentRotate * 2}deg)`;
      card.style.willChange = "auto";
    };

    if (isSelect) {
      if (isGood) {
        animateCardOut("right");
        Promise.resolve(onLike())
          .then((accepted) => {
            if (accepted === false) {
              resetCardPosition();
              return;
            }
          })
          .catch(() => {
            resetCardPosition();
          });
      } else {
        animateCardOut("left");
        passTimeoutRef.current = window.setTimeout(() => {
          passTimeoutRef.current = null;
          onPass();
        }, 300);
      }
      return;
    }

    resetCardPosition();
  }, [
    cancelInteraction,
    isBlockingConnectionIssue,
    onLike,
    onPass,
    resetCardPosition,
    setBadgeOpacity,
  ]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchend", handleEnd);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (passTimeoutRef.current !== null) {
        window.clearTimeout(passTimeoutRef.current);
      }
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [handleMove, handleEnd]);

  useEffect(() => {
    if (!isBlockingConnectionIssue) {
      return;
    }

    cancelInteraction();
  }, [cancelInteraction, isBlockingConnectionIssue]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "none";
    card.style.transform = isMobile
      ? "translateY(8px) scale(0.98)"
      : "translateY(-24px) scale(0.97)";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = "transform 0.3s ease-out";
        card.style.transform = "translateY(0) scale(1)";
      });
    });
  }, [profile.id, isMobile]);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center px-2 md:px-8">
      <div
        ref={cardRef}
        onTouchStart={handleStart}
        onMouseDown={handleStart}
        style={{
          touchAction: isBlockingConnectionIssue ? "auto" : "none",
        }}
      className="relative w-full max-w-5xl cursor-grab select-none active:cursor-grabbing"
      >
        <div
          ref={likeBadgeRef}
          style={{ opacity: 0 }}
          className="pointer-events-none absolute top-12 left-12 z-20 rounded-xl border-4 border-green-500 px-4 py-2 text-4xl font-black text-green-500 uppercase -rotate-15 md:top-20 md:left-20"
        >
          LIKE
        </div>
        <div
          ref={nopeBadgeRef}
          style={{ opacity: 0 }}
          className="pointer-events-none absolute top-12 right-12 z-20 rounded-xl border-4 border-red-500 px-4 py-2 text-4xl font-black text-red-500 uppercase rotate-15 md:top-20 md:right-20"
        >
          NOPE
        </div>

        <MatchProfileCard
          profile={profile}
          isMobile={isMobile}
          onPass={onPass}
          onLike={onLike}
          onOpenReport={onOpenReport}
          onPrepareTestMatch={onPrepareTestMatch}
          isPreparingTestMatch={isPreparingTestMatch}
        />
      </div>
    </div>
  );
}

export function SwipeHint() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center px-4 md:bottom-6">
      <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/88 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <span className="inline-flex items-center gap-1.5 text-rose-500">
          <X className="size-3.5" />
          Pass
        </span>
        <span className="h-3 w-px bg-slate-200" />
        <span className="inline-flex items-center gap-1.5 text-emerald-500">
          <Heart className="size-3.5" />
          Like
        </span>
      </div>
    </div>
  );
}
