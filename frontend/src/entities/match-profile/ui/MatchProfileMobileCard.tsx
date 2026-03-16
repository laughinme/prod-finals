import { useState } from "react";
import {
  Heart,
  Info,
  MapPin,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { MatchProfile } from "../model";
import { ScoreBreakdownPopover } from "./ScoreBreakdownPopover";

interface MatchProfileMobileCardProps {
  profile: MatchProfile;
  onLike: () => void;
  onPass: () => void;
  onOpenReport: () => void;
  onPrepareTestMatch?: () => void;
  isPreparingTestMatch?: boolean;
  showMatchScore?: boolean;
  showReportButton?: boolean;
  showActions?: boolean;
}

export function MatchProfileMobileCard({
  profile,
  onLike,
  onPass,
  onOpenReport,
  onPrepareTestMatch,
  isPreparingTestMatch = false,
  showMatchScore = true,
  showReportButton = true,
  showActions = true,
}: MatchProfileMobileCardProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  const title =
    profile.age !== null ? `${profile.name}, ${profile.age}` : profile.name;

  return (
    <div className="mx-auto flex h-full max-h-[calc(100dvh-5rem)] w-full justify-center select-none">
      <div className="flex h-full flex-col overflow-hidden rounded-4xl border-2 border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:rounded-[40px]">
        {/* Image section */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {profile.image ? (
            <img
              src={profile.image}
              alt={profile.name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              draggable="false"
            />
          ) : (
            <div className="h-full w-full bg-secondary" />
          )}

          {/* Top Bar: Test match + Report */}
          {showReportButton ? (
            <div className="absolute top-4 right-4 left-4 flex items-start justify-end gap-2">
              {onPrepareTestMatch ? (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={onPrepareTestMatch}
                  disabled={isPreparingTestMatch}
                  className="rounded-full bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/60 disabled:opacity-60"
                >
                  {t("discovery.test_match_button")}
                </button>
              ) : null}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={onOpenReport}
                className="flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/60"
                aria-label={t("discovery.report_profile")}
              >
                <ShieldAlert className="size-4" />
              </button>
            </div>
          ) : null}

          {/* Match score on image */}
          {showMatchScore ? (
            <div className="absolute bottom-3 left-3">
              <ScoreBreakdownPopover categories={profile.categoryBreakdown}>
                <div className="rounded-lg border border-primary/20 bg-black/70 px-2.5 py-1 text-sm font-black text-primary backdrop-blur-md">
                  {profile.matchScore}%
                </div>
              </ScoreBreakdownPopover>
            </div>
          ) : null}
        </div>

        {/* White content area */}
        <div className="shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
              {profile.location ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {profile.location}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Compatibility badge */}
              {showMatchScore ? (
                <ScoreBreakdownPopover categories={profile.categoryBreakdown}>
                  <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 transition-all active:scale-95">
                    <Heart className="size-3.5 fill-red-500 text-red-500" />
                    <span className="text-xs font-bold text-foreground">
                      {profile.matchScore}%
                    </span>
                  </div>
                </ScoreBreakdownPopover>
              ) : null}

              {/* Info toggle */}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => setShowDetails(!showDetails)}
                className={`flex size-9 items-center justify-center rounded-full border transition-all ${
                  showDetails
                    ? "border-primary bg-primary text-black"
                    : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                <Info className="size-4" />
              </button>
            </div>
          </div>

          {/* Expandable Details */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {profile.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {profile.bio ? (
                  <p className="border-l-2 border-primary/30 pl-2.5 text-xs leading-relaxed text-muted-foreground italic">
                    {profile.bio}
                  </p>
                ) : null}

                {profile.explanation ? (
                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-2.5">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                      <Sparkles className="size-3" />
                      {t("discovery.why_matched")}
                    </p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      {profile.explanation}
                    </p>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        {showActions ? (
          <div className="flex shrink-0 items-center justify-center gap-5 border-t border-border px-5 py-3">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onPass}
              className="flex size-14 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:bg-secondary"
              aria-label={t("discovery.pass_profile")}
            >
              <X className="size-7 text-muted-foreground" />
            </button>

            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onLike}
              className="flex size-16 items-center justify-center rounded-full bg-primary shadow-[0_0_20px_rgba(255,221,45,0.25)] transition-transform hover:scale-105"
              aria-label={t("discovery.like_profile")}
            >
              <Heart className="size-8 fill-black text-black" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
