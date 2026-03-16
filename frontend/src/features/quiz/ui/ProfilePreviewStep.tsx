import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, PencilLine, Sparkles, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";

import { MatchProfileCard } from "@/entities/match-profile/ui";
import type { MatchProfile } from "@/entities/match-profile/model";
import type { User } from "@/entities/user/model";
import {
  useProfile,
  useSetDefaultAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from "@/features/profile";
import { postOnboardingAnswers } from "@/shared/api/onboarding";
import { Button } from "@/shared/components/ui/button";
import { getAge } from "@/shared/lib/date";
import { useIsMobile } from "@/shared/hooks/use-mobile";

function buildPreviewProfile(
  profile: User | undefined,
  goalLabel: string | null,
  bio: string,
): MatchProfile | null {
  if (!profile) {
    return null;
  }

  const tags = [
    ...(goalLabel ? [goalLabel] : []),
    ...profile.interests.slice(0, 4),
  ];

  return {
    id: profile.email,
    candidateUserId: null,
    name: profile.fullName,
    age: getAge(profile.birthDate),
    image: profile.profilePicUrl,
    bio,
    matchScore: 0,
    categoryBreakdown: [],
    tags,
    explanation: goalLabel
      ? `Мы будем учитывать вашу цель знакомства: ${goalLabel}.`
      : "Эта карточка появится в ленте сразу после короткого онбординга.",
    location: profile.city?.name ?? "",
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
  const goalLabel = profile?.goal
    ? t(`profile.goal_${profile.goal}`, { defaultValue: profile.goal })
    : null;
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
    },
  });

  const previewProfile = useMemo(
    () => buildPreviewProfile(profile, goalLabel, bioDraft),
    [bioDraft, goalLabel, profile],
  );
  const isPhotoPending = isDefaultPending || isUploadPending;
  const hasBioChanges = bioDraft.trim() !== (profile?.bio ?? "").trim();

  if (isLoading || !profile || !previewProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleContinue = async () => {
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,221,45,0.18),_transparent_35%),linear-gradient(180deg,rgba(16,18,24,0.02),rgba(16,18,24,0.08))] px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-2xl shadow-primary/5 backdrop-blur-sm md:p-8"
        >
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">
              <Sparkles className="size-4" />
              {t("profile.preview_badge")}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
                {t("profile.profile_ready_title")}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                {t("profile.preview_description")}
              </p>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="min-w-0"
          >
            <MatchProfileCard
              profile={previewProfile}
              isMobile={isMobile}
              onLike={() => false}
              onPass={() => undefined}
              onOpenReport={() => undefined}
              showMatchScore={false}
              showReportButton={false}
              showActions={false}
            />
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-lg shadow-primary/5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                <PencilLine className="size-4" />
                {t("profile.preview_bio_label")}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("profile.preview_bio_hint")}
              </p>
              <textarea
                value={bioDraft}
                onChange={(event) => setBioDraft(event.target.value)}
                placeholder={t("profile.tell_about_yourself")}
                rows={5}
                className="mt-4 w-full resize-none rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm leading-6 outline-none transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div className="rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-lg shadow-primary/5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                {t("profile.preview_photo_label")}
              </p>
              <h2 className="mt-2 text-2xl font-bold">{t("profile.preview_photo_title")}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {profile.hasApprovedPhoto
                  ? t("profile.preview_photo_ready")
                  : t("profile.preview_photo_optional")}
              </p>

              <div className="mt-5 space-y-3">
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
                  className="w-full rounded-2xl"
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

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void handleFileSelect(event)}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={profile.hasApprovedPhoto ? "with-photo" : "without-photo"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-lg shadow-primary/5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                  {t("profile.preview_next_label")}
                </p>
                <h3 className="mt-2 text-xl font-bold">{t("profile.preview_next_title")}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("profile.preview_next_description")}
                </p>

                <div className="mt-5 flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="w-full rounded-2xl"
                    onClick={() => void handleContinue()}
                    disabled={completePreview.isPending || isPhotoPending || isBioPending}
                  >
                    {completePreview.isPending || isBioPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      t("profile.preview_continue")
                    )}
                  </Button>
                  {!profile.hasApprovedPhoto ? (
                    <p className="text-center text-xs leading-5 text-muted-foreground">
                      {t("profile.preview_continue_without_photo")}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
