import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pencil } from "lucide-react";

import { useProfile, useUpdateProfile } from "@/features/profile/useProfile";
import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { useQuizCompletion } from "@/features/quiz/model";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";

export function ProfilePreviewStep() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { completeOnboarding } = useMatchmakingFlow();
  const { markQuizCompleted } = useQuizCompletion();

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
  const title = profile.username || profile.email.split("@")[0];

  const handleSave = async () => {
    try {
      if (currentBio !== (profile.bio ?? "")) {
        await updateProfile.mutateAsync({ bio: currentBio });
      }
      markQuizCompleted();
      completeOnboarding();
      navigate("/discovery", { replace: true });
    } catch {
      // Error handled by useUpdateProfile (toast)
    }
  };

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-secondary/20 p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl space-y-6"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground md:text-4xl">
            Ваша анкета готова!
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

            <div
              className="mb-6 h-44 cursor-pointer rounded-xl border border-border bg-secondary/30 p-3"
              onClick={() => !isEditing && setIsEditing(true)}
            >
              {isEditing ? (
                <textarea
                  value={currentBio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  autoFocus
                  placeholder="Расскажите о себе..."
                  className="h-full w-full resize-none bg-transparent text-lg leading-relaxed text-foreground/80 outline-none"
                  onBlur={() => setIsEditing(false)}
                />
              ) : (
                <div className="flex h-full items-start justify-between gap-2">
                  <p className="text-lg leading-relaxed text-foreground/80 line-clamp-3">
                    {currentBio || (
                      <span className="text-muted-foreground italic">
                        Нажмите, чтобы добавить описание...
                      </span>
                    )}
                  </p>
                  <Pencil className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="mt-auto" />
          </div>

          {/* Button centered across full card width */}
          <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
            <Button
              size="lg"
              className="h-14 min-w-64 rounded-2xl text-lg shadow-lg hover:bg-primary"
              onClick={handleSave}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Сохранить и начать"
              )}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
