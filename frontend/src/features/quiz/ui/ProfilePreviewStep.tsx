import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  PencilLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";

import { MatchProfileCard } from "@/entities/match-profile/ui";
import type { MatchProfile } from "@/entities/match-profile/model";
import { useProfile, useSetDefaultAvatar, useUpdateProfile, useUploadAvatar } from "@/features/profile";
import { postOnboardingAnswers } from "@/shared/api/onboarding";
import { Button } from "@/shared/components/ui/button";
import { getAge } from "@/shared/lib/date";
import { useIsMobile } from "@/shared/hooks/use-mobile";

function buildPreviewProfile(
  fullName: string,
  birthDate: string | null,
  cityName: string | null,
  image: string | null,
  tags: string[],
): MatchProfile {
  return {
    id: "preview-card",
    candidateUserId: null,
    name: fullName,
    age: birthDate ? getAge(birthDate) : null,
    image,
    bio: "",
    matchScore: 0,
    categoryBreakdown: [],
    tags,
    explanation: "",
    location: cityName ?? "",
    reasonCodes: [],
    detailsAvailable: false,
    actions: null,
    source: "feed",
  };
}

export function ProfilePreviewStep() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: profile, isLoading } = useProfile();
  const { mutateAsync: setDefaultAvatar, isPending: isDefaultPending } = useSetDefaultAvatar();
  const { mutateAsync: uploadAvatar, isPending: isUploadPending } = useUploadAvatar();
  const { mutateAsync: updateProfile, isPending: isBioPending } = useUpdateProfile();
  const [bioDraft, setBioDraft] = useState("");

  useEffect(() => {
    setBioDraft(profile?.bio ?? "");
  }, [profile?.bio]);

  const completePreview = useMutation({
    mutationFn: () =>
      postOnboardingAnswers({
        stepKey: "profile_preview",
        answers: ["confirmed"],
      }),
    onSuccess: (nextState) => {
      queryClient.setQueryData(["onboarding", "state"], nextState);
      void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });

  const goalLabel = profile?.goal
    ? t(`profile.goal_${profile.goal}`, { defaultValue: profile.goal })
    : null;
  const tags = useMemo(
    () => [goalLabel, ...((profile?.interests ?? []).slice(0, 4))].filter(Boolean) as string[],
    [goalLabel, profile?.interests],
  );
  const previewProfile = useMemo(() => {
    if (!profile) {
      return null;
    }
    return buildPreviewProfile(
      profile.fullName,
      profile.birthDate,
      profile.city?.name ?? null,
      profile.profilePicUrl,
      tags,
    );
  }, [profile, tags]);
  const hasBioChanges = bioDraft.trim() !== (profile?.bio ?? "").trim();
  const isPhotoPending = isDefaultPending || isUploadPending;
  const canContinue = Boolean(profile?.hasApprovedPhoto) && !isPhotoPending;
  const customBioContent = (
    <div
      className={[
        "rounded-[1.35rem] border px-4 py-4 shadow-sm",
        isMobile
          ? "border-white/12 bg-white/10 backdrop-blur-md"
          : "border-border/60 bg-background/70",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]",
          isMobile ? "text-primary" : "text-primary/80",
        ].join(" ")}
      >
        <PencilLine className="size-4" />
        {t("profile.preview_bio_label")}
      </div>
      <p
        className={[
          "mt-2 text-sm leading-5",
          isMobile ? "text-white/72" : "text-muted-foreground",
        ].join(" ")}
      >
        {t("profile.preview_bio_hint")}
      </p>
      <textarea
        value={bioDraft}
        onChange={(event) => setBioDraft(event.target.value)}
        placeholder={t("profile.tell_about_yourself")}
        rows={isMobile ? 4 : 5}
        maxLength={500}
        className={[
          "mt-4 w-full resize-none rounded-[1.1rem] border px-4 py-4 text-sm leading-6 outline-none transition-all",
          isMobile
            ? "min-h-24 border-white/12 bg-black/22 text-white placeholder:text-white/42 focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            : "min-h-28 border-border/60 bg-card text-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/15",
        ].join(" ")}
      />
    </div>
  );

  if (isLoading || !profile || !previewProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleContinue = async () => {
    if (!profile.hasApprovedPhoto) {
      return;
    }

    try {
      if (hasBioChanges) {
        await updateProfile({ bio: bioDraft.trim() || null });
      }
      await completePreview.mutateAsync();
      navigate("/discovery", { replace: true });
    } catch (error) {
      Sentry.captureException(error);
    }
  };

  const handleSetDefaultAvatar = async () => {
    try {
      await setDefaultAvatar();
    } catch (error) {
      Sentry.captureException(error);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await uploadAvatar(file);
    } catch (error) {
      Sentry.captureException(error);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,221,45,0.18),_transparent_35%),linear-gradient(180deg,rgba(16,18,24,0.02),rgba(16,18,24,0.08))] px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mx-auto w-full ${isMobile ? "max-w-[420px]" : "max-w-5xl"} overflow-hidden rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-2xl shadow-primary/5 backdrop-blur-sm md:p-7`}
        >
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">
              <Sparkles className="size-4" />
              {t("profile.preview_badge")}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                {t("profile.profile_ready_title")}
              </h1>
              <p className="mx-auto max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                {t("profile.preview_description")}
              </p>
            </div>
          </div>
        </motion.section>

        <div className="flex justify-center">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="w-full max-w-5xl"
          >
            <div className="relative">
              <div className={isMobile ? "mx-auto max-w-[420px]" : "mx-auto max-w-5xl"}>
                <MatchProfileCard
                  profile={previewProfile}
                  isMobile={isMobile}
                  onLike={() => false}
                  onPass={() => undefined}
                  onOpenReport={() => undefined}
                  showMatchScore={false}
                  showReportButton={false}
                  showActions={false}
                  customBioContent={customBioContent}
                />
              </div>

              <AnimatePresence mode="wait">
                {!profile.hasApprovedPhoto ? (
                  <motion.div
                    key="photo-required"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className={[
                      "pointer-events-none absolute z-20",
                      isMobile
                        ? "left-4 right-4 top-[5%]"
                        : "left-6 top-1/2 w-[calc(45%-3rem)] -translate-y-1/2",
                    ].join(" ")}
                  >
                    <div className="pointer-events-auto w-full rounded-[1.8rem] border border-white/15 bg-black/60 p-5 text-center text-white shadow-xl backdrop-blur-xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                        {t("profile.preview_photo_label")}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-white/80">
                        {t("profile.preview_photo_required")}
                      </p>
                      <div className="mt-5 flex flex-col gap-3">
                        <Button
                          type="button"
                          size="lg"
                          className="w-full rounded-2xl"
                          disabled={isPhotoPending}
                          onClick={() => void handleSetDefaultAvatar()}
                        >
                          {isDefaultPending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <>
                              <Wand2 className="size-4.5" />
                              {t("profile.set_default_photo")}
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="lg"
                          className="w-full rounded-2xl bg-white/12 text-white hover:bg-white/18"
                          disabled={isPhotoPending}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isUploadPending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <>
                              <Camera className="size-4.5" />
                              {t("profile.upload_photo")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {profile.hasApprovedPhoto ? (
                <div className={[
                  "absolute bottom-4 z-20 flex -translate-x-1/2 items-center gap-2",
                  isMobile ? "left-1/2 px-4" : "left-[22.5%]",
                ].join(" ")}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-full border border-white/15 bg-white/90 shadow-lg backdrop-blur-md"
                    disabled={isPhotoPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="size-4" />
                    {t("profile.upload_photo")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-full border border-white/15 bg-white/90 shadow-lg backdrop-blur-md"
                    disabled={isPhotoPending}
                    onClick={() => void handleSetDefaultAvatar()}
                  >
                    <Wand2 className="size-4" />
                    {t("profile.preview_replace_with_demo")}
                  </Button>
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void handleFileSelect(event)}
              />
            </div>

            <div className="mx-auto mt-4 w-full max-w-3xl space-y-4">
              <div className="rounded-[1.8rem] border border-border/60 bg-card/92 p-4 shadow-lg shadow-primary/5">
                <div className="rounded-[1.4rem] border border-border/60 bg-background/60 px-4 py-3 text-sm leading-6 text-foreground/80">
                  {profile.hasApprovedPhoto ? (
                    <span className="inline-flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      {t("profile.preview_ready_status")}
                    </span>
                  ) : (
                    <span className="inline-flex items-start gap-2">
                      <Camera className="mt-0.5 size-4 shrink-0 text-primary" />
                      {t("profile.preview_need_photo_status")}
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  size="lg"
                  className="mt-4 h-14 w-full rounded-[1.2rem] text-base font-semibold shadow-[0_18px_40px_rgba(255,221,45,0.26)]"
                  disabled={!canContinue || completePreview.isPending || isBioPending}
                  onClick={() => void handleContinue()}
                >
                  {completePreview.isPending || isBioPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      {t("profile.preview_continue")}
                      <ArrowRight className="size-4.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
