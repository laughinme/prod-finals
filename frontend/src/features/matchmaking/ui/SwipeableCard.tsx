import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchProfile } from "@/entities/match-profile/model";
import { MatchProfileCard } from "@/entities/match-profile/ui";
import { getPosition } from "./utils/get-position";
import { clamp } from "./utils/clamp";

interface SwipeableCardProps {
  profile: MatchProfile;
  isMobile: boolean;
  onLike: () => void;
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
  const interactionRef = useRef<{ x: number; y: number } | undefined>(
    undefined,
  );
  const [progress, setProgress] = useState(0);

  const handleStart = useCallback(
    (
      e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
    ) => {
      const card = cardRef.current;
      if (!card) return;

      card.style.transition = "";

      const { x, y } = getPosition(e);
      interactionRef.current = { x, y };
    },
    [],
  );

  const handleMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!interactionRef.current) return;
    const card = cardRef.current;
    if (!card) return;

    const { x, y } = getPosition(e);
    const dx = (x - interactionRef.current.x) * 0.8;
    const dy = (y - interactionRef.current.y) * 0.5;
    const deg = (dx / 600) * -30;

    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${deg}deg)`;

    const newProgress = clamp(dx / 100, -1, 1);
    setProgress(newProgress);
  }, []);

  const handleEnd = useCallback(() => {
    if (!interactionRef.current) return;
    const card = cardRef.current;
    if (!card) return;

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

    const dx = isGood
      ? window.innerWidth
      : (window.innerWidth + card.getBoundingClientRect().width) * -1;

    card.style.transition = "transform 0.3s ease-in-out";
    card.style.transform = isSelect
      ? `translate(${currentX + dx}px, ${currentY}px) rotate(${currentRotate * 2}deg)`
      : "translate(0px, 0px) rotate(0deg)";

    interactionRef.current = undefined;
    setProgress(0);

    if (isSelect) {
      setTimeout(() => {
        if (isGood) {
          onLike();
        } else {
          onPass();
        }
      }, 300);
    }
  }, [onLike, onPass, progress]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [handleMove, handleEnd]);

  const likeOpacity = clamp(progress, 0, 1);
  const nopeOpacity = clamp(-progress, 0, 1);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = "none";
    card.style.transform = "translateY(-24px) scale(0.97)";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = "transform 0.3s ease-out";
        card.style.transform = "translateY(0) scale(1)";
      });
    });
  }, [profile.id]);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center px-4 md:px-8">
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
          style={{ opacity: likeOpacity }}
          className="pointer-events-none absolute top-12 left-12 z-20 rounded-xl border-4 border-green-500 px-4 py-2 text-4xl font-black text-green-500 uppercase -rotate-15 md:top-20 md:left-20"
        >
          LIKE
        </div>
        <div
          style={{ opacity: nopeOpacity }}
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
