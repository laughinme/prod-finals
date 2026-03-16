import { useState } from "react";
import {
  Heart,
  Info,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { DiscoveryProfileCardViewProps } from "./DiscoveryProfileCard";
import { ScoreBreakdownPopover } from "@/entities/match-profile/ui/ScoreBreakdownPopover";

type DiscoveryMobileProfileCardProps = DiscoveryProfileCardViewProps & {
  showMatchScore?: boolean;
  showActions?: boolean;
  showReportButton?: boolean;
};

export function DiscoveryMobileProfileCard({
  profile,
  onLike,
  onPass,
  showMatchScore = true,
  showActions = true,
}: DiscoveryMobileProfileCardProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  const title =
    profile.age !== null ? `${profile.name}, ${profile.age}` : profile.name;

  return (
    <div className="mx-auto flex h-full max-h-[calc(100dvh-5rem)] w-full justify-center">
      <div className="flex h-full flex-col overflow-hidden rounded-4xl border-2 border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.08)] sm:rounded-[40px]">
        {/* Image section */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {profile.image ? (
            <img
              src={profile.image}
              alt={profile.name}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-full w-full bg-secondary" />
          )}

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

              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`flex size-9 items-center justify-center rounded-full border transition-all ${showDetails
                    ? "border-primary bg-primary text-black"
                    : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  }`}
              >
                <Info className="size-4" />
              </button>
            </div>
          </div>

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
              onClick={onPass}
              className="flex size-14 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:bg-secondary"
              aria-label={t("discovery.pass_profile_aria")}
            >
              <X className="size-7 text-muted-foreground" />
            </button>

            <button
              onClick={onLike}
              className="flex size-16 items-center justify-center rounded-full bg-primary shadow-[0_0_20px_rgba(255,221,45,0.25)] transition-transform hover:scale-105"
              aria-label={t("discovery.like_profile_aria")}
            >
              <Heart className="size-8 fill-black text-black" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
