import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useProfile, useUpdateProfile } from "@/features/profile/useProfile";
import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { useQuizProfilePreviewState } from "@/features/quiz/model";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import * as Sentry from "@sentry/react";

export function ProfilePreviewStep() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { completeOnboarding } = useMatchmakingFlow();
  const { clearProfilePreviewPending } = useQuizProfilePreviewState();

  const [bio, setBio] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    );
  }

  const currentBio = bio ?? profile.bio ?? "";
  const title = profile.fullName || profile.email.split("@")[0];

  const handleSave = async () => {
    try {
      if (currentBio !== (profile.bio ?? "")) {
        await updateProfile.mutateAsync({ bio: currentBio });
      }
      clearProfilePreviewPending();
      completeOnboarding();
      navigate("/discovery", { replace: true });
    } catch (e) {
      Sentry.captureException(e);
    }
  };

  const bioEditor = (
    <div
      className="cursor-pointer rounded-xl border border-border bg-secondary/30 p-3"
      onClick={() => !isEditing && setIsEditing(true)}
    >
      {isEditing ? (
        <textarea
          value={currentBio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          autoFocus
          placeholder={t("profile.tell_about_yourself")}
          className="h-32 w-full resize-none bg-transparent text-base leading-relaxed text-foreground/80 outline-none md:h-44 md:text-lg"
          onBlur={() => setIsEditing(false)}
        />
      ) : (
        <div className="flex min-h-20 items-start justify-between gap-2 md:min-h-32">
          <p className="text-base leading-relaxed text-foreground/80 line-clamp-3 md:text-lg">
            {currentBio || (
              <span className="text-muted-foreground italic">
                {t("profile.add_description_hint")}
              </span>
            )}
          </p>
          <Pencil className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </div>
      )}
    </div>
  );

  const saveButton = (
    <Button
      size="lg"
      className="h-12 w-full rounded-2xl text-base font-semibold shadow-lg hover:bg-primary md:h-14 md:min-w-64 md:w-auto md:text-lg"
      onClick={handleSave}
      disabled={updateProfile.isPending}
    >
      {updateProfile.isPending ? (
        <Loader2 className="animate-spin" />
      ) : (
        t("common.save_and_start")
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-1 flex-col bg-secondary/20 px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5"
        >
          <h1 className="text-center text-2xl font-bold text-foreground">
            {t("profile.profile_ready_title")}
          </h1>

          {/* Mobile card with inline bio editor */}
          <div className="mx-auto w-full max-w-100">
            <div className="relative aspect-4/7 overflow-hidden rounded-4xl bg-black shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
              {profile.profilePicUrl ? (
                <img
                  src={profile.profilePicUrl}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 bg-secondary" />
              )}
              <div className="absolute inset-0 bg-linear-to-t from-[#0A0A0A] via-[#0A0A0A]/55 to-transparent" />

              <div className="absolute right-6 bottom-6 left-6 flex flex-col gap-3">
                <h2 className="text-[32px] leading-tight font-extrabold tracking-tight text-white">
                  {title}
                </h2>

                <div
                  className="cursor-pointer rounded-xl bg-white/15 p-3 backdrop-blur-md"
                  onClick={() => !isEditing && setIsEditing(true)}
                >
                  {isEditing ? (
                    <textarea
                      value={currentBio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={500}
                      autoFocus
                      placeholder={t("profile.tell_about_yourself")}
                      className="h-24 w-full resize-none bg-transparent text-sm leading-relaxed text-gray-100 placeholder:text-gray-400 outline-none"
                      onBlur={() => setIsEditing(false)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed text-gray-200 line-clamp-4">
                        {currentBio || (
                          <span className="text-gray-400 italic">
                            {t("profile.add_description_hint")}
                          </span>
                        )}
                      </p>
                      <Pencil className="mt-0.5 size-4 shrink-0 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4">{saveButton}</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-secondary/20 p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl space-y-6"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            {t("profile.profile_ready_title")}
          </h1>
        </div>

        <Card className="relative flex flex-col overflow-hidden rounded-4xl border-border bg-card p-0 shadow-2xl shadow-primary/5 md:flex-row">
          <div className="relative h-[50vh] w-full shrink-0 md:h-[70vh] md:w-[45%]">
            {profile.profilePicUrl ? (
              <img
                src={profile.profilePicUrl}
                alt={title}
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 bg-secondary" />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent md:hidden" />
            <div className="absolute right-4 bottom-4 left-4 text-white md:hidden">
              <h2 className="text-3xl font-bold">{title}</h2>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col p-8 md:h-[70vh] md:w-[55%] md:overflow-y-auto md:px-12 md:pt-6 md:pb-12">
            <div className="mb-6 hidden items-start justify-between gap-6 md:flex">
              <div className="min-w-0 pt-15">
                <h2 className="mb-3 text-6xl font-black tracking-tight text-foreground">
                  {title}
                </h2>
              </div>
            </div>

            <div className="mb-6">{bioEditor}</div>

            <div className="mt-auto" />
          </div>

          <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
            {saveButton}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
