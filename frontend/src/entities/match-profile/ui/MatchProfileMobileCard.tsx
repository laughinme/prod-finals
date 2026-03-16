import { useState, type CSSProperties } from "react";
import {
  Heart,
  Info,
  MapPin,
  ShieldAlert,
  Sparkles,
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
  onOpenReport,
  onPrepareTestMatch,
  isPreparingTestMatch = false,
  showMatchScore = true,
  showReportButton = true,
}: MatchProfileMobileCardProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  const title =
    profile.age !== null ? `${profile.name}, ${profile.age}` : profile.name;
  const hasDetails = Boolean(
    profile.bio ||
      profile.location ||
      profile.tags.length > 0 ||
      profile.explanation,
  );
  const cardFrameStyle: CSSProperties = {
    width: "min(100%, 400px, calc((100dvh - 5rem) * 0.5333333333))",
    maxHeight: "calc(100dvh - 5rem)",
    aspectRatio: "400 / 750",
  };

  return (
    <div className="mx-auto flex w-full justify-center select-none">
      <div
        style={cardFrameStyle}
        className="relative overflow-hidden rounded-[32px] border border-[#1a2740] bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
      >
        {profile.image ? (
          <img
            src={profile.image}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
            draggable="false"
          />
        ) : (
          <div className="absolute inset-0 bg-[#1b1b1b]" />
        )}

        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-black via-black/85 via-45% to-transparent pointer-events-none" />

        {onPrepareTestMatch ? (
          <div className="absolute top-5 left-5 z-20">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onPrepareTestMatch}
              disabled={isPreparingTestMatch}
              className="rounded-full bg-black/45 px-5 py-3 text-[13px] font-semibold tracking-wide text-white backdrop-blur-md transition-colors hover:bg-black/55 disabled:opacity-60"
            >
              {t("discovery.test_match_button")}
            </button>
          </div>
        ) : null}

        {showReportButton ? (
          <div className="absolute top-5 right-5 z-20">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onOpenReport}
              className="flex size-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/55"
              aria-label={t("discovery.report_profile")}
              title={t("discovery.report_profile")}
            >
              <ShieldAlert size={18} strokeWidth={2} />
            </button>
          </div>
        ) : null}

        <AnimatePresence>
          {showDetails && hasDetails ? (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-x-5 bottom-24 z-20 overflow-hidden rounded-[26px] border border-white/10 bg-black/70 p-4 backdrop-blur-xl"
            >
              <div className="space-y-3 text-white/85">
                {profile.location ? (
                  <div className="flex items-center gap-2 text-sm text-white/75">
                    <MapPin className="size-4 shrink-0" />
                    <span>{profile.location}</span>
                  </div>
                ) : null}

                {profile.bio ? (
                  <p className="text-sm leading-6 text-white/80">{profile.bio}</p>
                ) : null}

                {profile.explanation ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      <Sparkles className="size-3" />
                      {t("discovery.why_matched")}
                    </p>
                    <p className="text-xs leading-5 text-white/75">
                      {profile.explanation}
                    </p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pt-24 pb-6">
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              {profile.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {profile.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-white/12 bg-white/12 px-4 py-2 text-[13px] font-medium leading-none text-white/88 backdrop-blur-md"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <h2 className="text-[34px] font-bold leading-[0.96] tracking-[-0.04em] text-white drop-shadow-md">
                {title}
              </h2>
              {profile.bio ? (
                <p className="max-w-[18rem] text-[15px] leading-[1.35] text-white/80">
                  {profile.bio}
                </p>
              ) : null}
            </div>

            <div className="flex items-end justify-between gap-4">
              {showMatchScore ? (
                <ScoreBreakdownPopover categories={profile.categoryBreakdown}>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md">
                    <Heart
                      size={14}
                      className="fill-[#FF453A] text-[#FF453A]"
                    />
                    <span className="text-[15px] font-semibold text-white">
                      {profile.matchScore}%
                    </span>
                  </div>
                </ScoreBreakdownPopover>
              ) : (
                <div />
              )}

              <button
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => setShowDetails((value) => !value)}
                className={`flex size-14 items-center justify-center rounded-full border text-white backdrop-blur-md transition-colors ${
                  showDetails
                    ? "border-white/20 bg-black/70"
                    : "border-white/10 bg-black/45 hover:bg-black/55"
                }`}
                aria-label={t("common.details")}
                title={t("common.details")}
              >
                <Info size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
