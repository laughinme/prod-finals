import { useCallback, useEffect, useRef } from "react";
import type { MatchProfile } from "@/entities/match-profile/model";
import { MatchProfileCard } from "@/entities/match-profile/ui";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const likeBadgeRef = useRef<HTMLDivElement>(null);
  const nopeBadgeRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{ x: number; y: number } | undefined>(
    undefined,
  );
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
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

  const handleStart = useCallback(
    (
      e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
    ) => {
      const card = cardRef.current;
      if (!card) return;

      card.style.transition = "";
      card.style.willChange = "transform";

      const { x, y } = getPosition(e);
      interactionRef.current = { x, y };
    },
    [],
  );

  const handleMove = useCallback((e: TouchEvent | MouseEvent) => {
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
  }, [setBadgeOpacity]);

  const handleEnd = useCallback(() => {
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

    const resetCardPosition = () => {
      card.style.transition = "transform 0.25s ease-out";
      card.style.transform = "translate(0px, 0px) rotate(0deg)";
      card.style.willChange = "auto";
    };

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
        setTimeout(() => {
          onPass();
        }, 300);
      }
      return;
    }

    resetCardPosition();
  }, [onLike, onPass, setBadgeOpacity]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchend", handleEnd);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [handleMove, handleEnd]);

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
          touchAction: "none",
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
