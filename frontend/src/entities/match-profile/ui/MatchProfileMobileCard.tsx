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
    <div className="mx-auto w-full max-w-100 select-none">
      <div className="relative aspect-4/7 overflow-hidden rounded-4xl bg-black shadow-[0_20px_60px_rgba(0,0,0,0.15)] sm:rounded-[40px]">
        {/* Background Image */}
        {profile.image ? (
          <img
            src={profile.image}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
            draggable="false"
          />
        ) : null}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />

        {/* Top Bar: Report */}
        {showReportButton ? (
          <div className="absolute top-5 right-5 left-5 flex items-start justify-end gap-3 sm:top-6 sm:right-6 sm:left-6">
            <div className="flex gap-2">
              {onPrepareTestMatch ? (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={onPrepareTestMatch}
                  disabled={isPreparingTestMatch}
                  className="rounded-full bg-[#2A2A2A]/80 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-[#383838] disabled:opacity-60"
                >
                  {t("discovery.test_match_button")}
                </button>
              ) : null}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={onOpenReport}
                className="flex size-10 items-center justify-center rounded-full bg-[#2A2A2A]/80 text-white backdrop-blur-md transition-colors hover:bg-[#383838]"
                aria-label={t("discovery.report_profile")}
              >
                <ShieldAlert className="size-5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Content Overlay */}
        <div className="absolute right-0 bottom-0 left-0 p-6 pb-32">
          <div className="flex items-end justify-between">
            <div className="flex-1 pr-4">
              {/* Name & Age */}
              <h2 className="mb-1 text-3xl font-bold tracking-tight text-white drop-shadow-md">
                {title}
              </h2>

              {/* Location */}
              {profile.location ? (
                <p className="mb-4 flex items-center gap-1.5 text-sm font-medium text-white/80">
                  <MapPin className="size-4" />
                  {profile.location}
                </p>
              ) : null}

              {/* Compatibility badge */}
              {showMatchScore ? (
                <div className="flex flex-wrap gap-2">
                  <ScoreBreakdownPopover categories={profile.categoryBreakdown}>
                    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-md transition-all active:scale-95">
                      <div className="flex size-5 items-center justify-center rounded-full bg-red-500/20">
                        <Heart className="size-3 fill-red-500 text-red-500" />
                      </div>
                      <span className="text-sm font-bold text-white">
                        {profile.matchScore}%
                      </span>
                    </div>
                  </ScoreBreakdownPopover>
                </div>
              ) : null}
            </div>

            {/* Side buttons: Info toggle */}
            <div className="flex flex-col gap-3">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => setShowDetails(!showDetails)}
                className={`flex size-11 items-center justify-center rounded-full border backdrop-blur-md transition-all ${
                  showDetails
                    ? "border-primary bg-primary text-black shadow-[0_0_15px_rgba(255,221,45,0.5)]"
                    : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Info className="size-5" />
              </button>
            </div>
          </div>

          {/* Expandable Details: Tags, Bio, Explanation */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="space-y-4 overflow-hidden"
              >
                {/* Tags */}
                {profile.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Bio */}
                {profile.bio ? (
                  <div className="border-l-2 border-primary/50 pl-3 text-xs italic leading-relaxed text-white/70">
                    {profile.bio}
                  </div>
                ) : null}

                {/* Explanation / Why matched */}
                {profile.explanation ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
                    <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                      <Sparkles className="size-3" />{" "}
                      {t("discovery.why_matched")}
                    </p>
                    <p className="text-[11px] leading-tight text-white/90">
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
          <div className="absolute bottom-8 left-0 right-0 z-40 flex items-center justify-center gap-6">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onPass}
              className="flex size-16 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg transition-colors hover:bg-gray-50"
              aria-label={t("discovery.pass_profile")}
            >
              <X className="size-8 text-gray-400" />
            </button>

            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onLike}
              className="flex size-20 items-center justify-center rounded-full bg-primary shadow-[0_0_30px_rgba(255,221,45,0.3)] transition-transform hover:scale-105"
              aria-label={t("discovery.like_profile")}
            >
              <Heart className="size-10 fill-black text-black" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
