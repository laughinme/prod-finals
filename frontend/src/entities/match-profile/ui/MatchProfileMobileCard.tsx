import { useState, type CSSProperties, type ReactNode } from "react";
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
import { ProfileImageFallback } from "@/shared/components/ui/profile-image-fallback";

function getPrimaryLocation(location: string): string {
  return location.split(",")[0]?.trim() ?? "";
}

function getInterestLabels(profile: MatchProfile): string[] {
  const labels = [
    ...profile.tags,
    ...profile.categoryBreakdown.map((item) => item.label?.trim() ?? ""),
  ];

  return Array.from(
    new Set(
      labels.filter(
        (label) =>
          Boolean(label) &&
          label !== "<none>" &&
          label.toLowerCase() !== "unknown",
      ),
    ),
  ).slice(0, 3);
}

interface MatchProfileMobileCardProps {
  profile: MatchProfile;
  onLike: () => void | boolean | Promise<boolean | void>;
  onPass: () => void;
  onOpenReport: () => void;
  onPrepareTestMatch?: () => void;
  isPreparingTestMatch?: boolean;
  showMatchScore?: boolean;
  showReportButton?: boolean;
  showActions?: boolean;
  customBioContent?: ReactNode;
}

export function MatchProfileMobileCard({
  profile,
  onOpenReport,
  onPrepareTestMatch,
  isPreparingTestMatch = false,
  showMatchScore = true,
  showReportButton = true,
  customBioContent,
}: MatchProfileMobileCardProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [showCompatibilityDetails, setShowCompatibilityDetails] = useState(false);

  const title =
    profile.age !== null ? `${profile.name}, ${profile.age}` : profile.name;
  const primaryLocation = getPrimaryLocation(profile.location);
  const interestLabels = getInterestLabels(profile);
  const hasDetails = Boolean(primaryLocation || profile.explanation);
  const mobileViewportWidth = "calc(100vw - 1rem)";
  const cardFrameStyle: CSSProperties = {
    width: `min(${mobileViewportWidth}, 420px)`,
    height: `min(calc(100dvh - 5rem), calc(${mobileViewportWidth} * 1.72))`,
    maxHeight: "calc(100dvh - 5rem)",
  };
  const interestsSummary = interestLabels.length
    ? t("discovery.compatibility_interests_summary", {
        interests: interestLabels.slice(0, 2).join(", "),
      })
    : t("discovery.compatibility_interests_fallback");
  const locationSummary = primaryLocation
    ? t("discovery.compatibility_location_summary", {
        location: primaryLocation,
      })
    : t("discovery.compatibility_location_fallback");
  const lifestyleSummary =
    profile.explanation || t("discovery.compatibility_lifestyle_fallback");

  return (
    <div className="mx-auto flex w-full justify-center select-none">
      <div
        style={cardFrameStyle}
        className="relative overflow-hidden rounded-4xl border border-[#1a2740] bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
      >
        <ProfileImageFallback
          src={profile.image}
          alt={profile.name}
          containerClassName="absolute inset-0"
          fallbackClassName="bg-[#1b1b1b]"
          iconClassName="size-20 text-white/55"
          referrerPolicy="no-referrer"
          draggable="false"
        />

        <div className="absolute inset-x-0 top-0 h-36 bg-linear-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[62%] bg-linear-to-t from-black via-black/85 via-45% to-transparent pointer-events-none" />

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
              type="button"
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

        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pt-24 pb-6">
          <div className="flex flex-col gap-6">
            <div className="relative isolate space-y-3">
              <div className="pointer-events-none absolute -inset-x-5 -inset-y-5 -z-10 rounded-[38px] bg-linear-to-b from-black/24 via-black/48 to-black/72 blur-[34px]" />

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
              {customBioContent ? (
                <div>{customBioContent}</div>
              ) : profile.bio ? (
                <p className="max-w-[18rem] text-[15px] leading-[1.35] text-white/80">
                  {profile.bio}
                </p>
              ) : null}

              <AnimatePresence initial={false}>
                {showDetails && hasDetails ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 rounded-[28px] border border-white/10 bg-[#171717]/92 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                      {profile.explanation ? (
                        <div className="space-y-3">
                          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                            <Sparkles className="size-3.5" />
                            {t("discovery.why_matched")}
                          </p>
                          <p className="text-[15px] leading-8 text-white/80">
                            {profile.explanation}
                          </p>
                        </div>
                      ) : null}

                      {!profile.explanation && primaryLocation ? (
                        <div className="flex items-center gap-2 text-sm text-white/75">
                          <MapPin className="size-4 shrink-0" />
                          <span>{primaryLocation}</span>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="flex items-end justify-between gap-4">
              {showMatchScore ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={() => setShowCompatibilityDetails(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md transition-colors hover:bg-black/55"
                >
                  <Heart
                    size={14}
                    className="fill-[#FF453A] text-[#FF453A]"
                  />
                  <span className="text-[15px] font-semibold text-white">
                    {profile.matchScore}%
                  </span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={() => {
                  if (!hasDetails) {
                    return;
                  }
                  setShowDetails((value) => !value);
                }}
                disabled={!hasDetails}
                className={`flex size-14 items-center justify-center rounded-full border backdrop-blur-md transition-colors ${
                  showDetails
                    ? "border-sky-300/50 bg-sky-500/22 text-sky-200"
                    : "border-sky-300/30 bg-black/45 text-sky-300 hover:bg-black/55 hover:text-sky-200"
                }`}
                aria-label={t("common.details")}
                title={t("common.details")}
              >
                <Info size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showCompatibilityDetails && showMatchScore ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 z-30 bg-black/72 backdrop-blur-xl"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={() => setShowCompatibilityDetails(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="absolute inset-x-0 bottom-0 flex max-h-[86%] flex-col overflow-hidden rounded-t-[36px] bg-white shadow-[0_-18px_50px_rgba(0,0,0,0.2)]"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 px-6 pt-3 pb-2">
                  <div className="mx-auto h-1.5 w-14 rounded-full bg-primary/35" />
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={() => setShowCompatibilityDetails(false)}
                    className="absolute top-5 right-5 flex size-11 items-center justify-center rounded-full bg-primary/15 text-foreground/55 transition-colors hover:bg-primary/25 hover:text-foreground/75"
                    aria-label={t("common.close")}
                    title={t("common.close")}
                  >
                    <X size={19} strokeWidth={2.2} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
                  <div className="space-y-5 pt-1">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-primary/18 shadow-inner shadow-primary/20">
                        <Heart className="size-10 fill-black text-black" />
                      </div>
                      <h3 className="text-[22px] font-bold text-black">
                        {t("discovery.compatibility_match_title")}
                      </h3>
                      <div className="mt-2 text-[58px] leading-none font-black tracking-[-0.06em] text-primary">
                        {profile.matchScore}%
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <h4 className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-primary/80">
                        {t("discovery.compatibility_criteria_title")}
                      </h4>

                      <div className="space-y-3">
                        <div className="flex items-center gap-4 rounded-3xl border border-primary/20 bg-linear-to-r from-primary/18 via-primary/10 to-primary/6 p-4">
                          <div className="flex size-16 items-center justify-center rounded-[20px] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
                            <Sparkles className="size-7 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-black">
                              {t("discovery.compatibility_interests_title")}
                            </p>
                            <p className="mt-1 text-[13px] leading-5 text-foreground/65">
                              {interestsSummary}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 rounded-3xl border border-primary/20 bg-linear-to-r from-primary/18 via-primary/10 to-primary/6 p-4">
                          <div className="flex size-16 items-center justify-center rounded-[20px] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
                            <MapPin className="size-7 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-black">
                              {t("discovery.compatibility_location_title")}
                            </p>
                            <p className="mt-1 text-[13px] leading-5 text-foreground/65">
                              {locationSummary}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 rounded-3xl border border-primary/20 bg-linear-to-r from-primary/18 via-primary/10 to-primary/6 p-4">
                          <div className="flex size-16 items-center justify-center rounded-[20px] bg-white shadow-[0_6px_16px_rgba(15,23,42,0.08)]">
                            <Info className="size-7 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-black">
                              {t("discovery.compatibility_lifestyle_title")}
                            </p>
                            <p className="mt-1 text-[13px] leading-5 text-foreground/65">
                              {lifestyleSummary}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-0 -mx-6 bg-linear-to-t from-white via-[#fffdf0] to-white/90 px-6 pt-4 pb-1">
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={() => setShowCompatibilityDetails(false)}
                        className="w-full rounded-[28px] bg-primary px-6 py-4 text-[18px] font-bold text-primary-foreground shadow-[0_14px_30px_rgba(255,221,45,0.32)] transition-colors hover:bg-primary/90"
                      >
                        {t("discovery.compatibility_done")}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
