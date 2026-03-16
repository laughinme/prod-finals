import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Heart, Info, MapPin, ShieldAlert, Sparkles, X } from "lucide-react";

import type { MatchProfile } from "../model";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { ProfileImageFallback } from "@/shared/components/ui/profile-image-fallback";
import { ScoreBreakdownPopover } from "./ScoreBreakdownPopover";

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

interface MatchProfileDesktopCardProps {
  profile: MatchProfile;
  onOpenReport: () => void;
  onPrepareTestMatch?: () => void;
  isPreparingTestMatch?: boolean;
  showMatchScore?: boolean;
  showReportButton?: boolean;
}

export function MatchProfileDesktopCard({
  profile,
  onOpenReport,
  onPrepareTestMatch,
  isPreparingTestMatch = false,
  showMatchScore = true,
  showReportButton = true,
}: MatchProfileDesktopCardProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [showCompatibilityDetails, setShowCompatibilityDetails] = useState(false);
  const title = profile.age !== null ? `${profile.name}, ${profile.age}` : profile.name;
  const hasMeta = Boolean(profile.location);
  const hasDetails = Boolean(profile.explanation || profile.location);
  const detailsText = profile.explanation || profile.location;
  const primaryLocation = getPrimaryLocation(profile.location);
  const interestLabels = getInterestLabels(profile);
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
  const topPillClassName =
    "inline-flex h-12 items-center rounded-full border border-white/10 bg-black/90 px-5 shadow-xl backdrop-blur-md";

  const compatibilityModal = (
    <AnimatePresence>
      {showCompatibilityDetails && showMatchScore ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-80 flex items-center justify-center bg-black/72 p-6 backdrop-blur-xl"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={() => setShowCompatibilityDetails(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-140 flex-col overflow-hidden rounded-[36px] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.24)]"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-7 pt-6 pb-3">
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

            <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
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

                <div className="sticky bottom-0 -mx-7 bg-linear-to-t from-white via-[#fffdf0] to-white/90 px-7 pt-4 pb-1">
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
  );

  return (
    <>
      <Card className="relative flex flex-col overflow-hidden rounded-4xl border-2 border-black bg-card p-0 shadow-2xl shadow-primary/5 select-none md:flex-row">
        {onPrepareTestMatch ? (
          <div className="absolute top-6 left-6 z-20 hidden items-center gap-2 md:flex">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onPrepareTestMatch}
              disabled={isPreparingTestMatch}
              className={`${topPillClassName} text-[15px] font-semibold text-white transition-colors hover:bg-black/80 disabled:opacity-60`}
            >
              {t("discovery.test_match_button")}
            </button>
          </div>
        ) : null}

        <div className="relative h-[50vh] w-full shrink-0 md:h-[70vh] md:w-[45%]">
          <ProfileImageFallback
            src={profile.image}
            alt={profile.name}
            containerClassName="absolute inset-0"
            fallbackClassName="bg-secondary"
            iconClassName="size-20 text-muted-foreground/70"
            referrerPolicy="no-referrer"
            draggable="false"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent md:hidden" />

          {showMatchScore ? (
            <div className="absolute top-4 left-4 z-20 md:hidden">
              <ScoreBreakdownPopover categories={profile.categoryBreakdown}>
                <div className="rounded-lg border border-primary/20 bg-black/90 px-2.5 py-1 text-base font-black text-primary shadow-lg backdrop-blur-md ">
                  {profile.matchScore}%
                </div>
              </ScoreBreakdownPopover>
            </div>
          ) : null}

          <div className="absolute right-4 bottom-4 left-4 text-white md:hidden">
            <h2 className="text-3xl font-bold">{title}</h2>
          </div>
        </div>

        <div className="relative flex w-full shrink-0 flex-col p-8 md:h-[70vh] md:w-[55%] md:overflow-hidden md:px-12 md:pt-6 md:pb-12">
          <div className="mb-6 hidden items-start justify-between gap-6 md:flex">
            <div className="min-w-0 pt-[clamp(0.75rem,3.5vh,3.75rem)]">
              {profile.tags.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {profile.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="rounded-xl bg-secondary/50 px-4 py-2 text-sm font-semibold text-secondary-foreground"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <h2 className="mb-3 text-6xl font-black tracking-tight text-foreground">{title}</h2>
              {(showMatchScore || hasMeta || hasDetails) ? (
                <div className="flex items-center justify-between gap-6 font-medium text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-3">
                    {showMatchScore ? (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={() => setShowCompatibilityDetails(true)}
                        className="inline-flex h-10 shrink-0 items-center rounded-full border border-white/10 bg-black px-4 text-[18px] leading-none font-black text-primary shadow-lg transition-colors hover:bg-black/85"
                      >
                        {profile.matchScore}%
                      </button>
                    ) : null}

                    {profile.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-5 shrink-0" />
                        <span className="truncate">{profile.location}</span>
                      </span>
                    ) : null}
                  </div>

                  {hasDetails ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={() => {
                        setShowDetails((value) => !value);
                      }}
                      className={`shrink-0 transition-colors ${
                        showDetails
                          ? "text-sky-500"
                          : "text-sky-400 hover:text-sky-500"
                      }`}
                      aria-label={t("common.details")}
                      title={t("common.details")}
                    >
                      <Info className="size-7.5 opacity-80" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-start">
              {showReportButton ? (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  className="-mt-2 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  onClick={onOpenReport}
                >
                  <ShieldAlert className="size-7.5 opacity-80" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-3">
            <div className="space-y-6">
              <AnimatePresence initial={false}>
                {showDetails && hasDetails ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-4xl border border-primary/12 bg-primary/5 px-8 py-7">
                      <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="size-5 shrink-0 text-primary" />
                        <h4 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
                          {t("discovery.why_matched")}
                        </h4>
                      </div>
                      <p className="text-[18px] leading-[1.55] text-muted-foreground">
                        {detailsText}
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {profile.bio ? (
                <div>
                  <p className="text-lg leading-relaxed text-foreground/80">
                    {profile.bio}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {typeof document !== "undefined"
        ? createPortal(compatibilityModal, document.body)
        : null}
    </>
  );
}
