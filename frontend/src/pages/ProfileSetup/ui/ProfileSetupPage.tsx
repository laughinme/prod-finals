import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Camera, Check, UploadCloud } from "lucide-react";

import { useProfileSetup } from "@/pages/ProfileSetup/model";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export default function ProfileSetupPage() {
  const { t } = useTranslation();
  const {
    profile,
    photoUploaded,
    name,
    age,
    avatarPreview,
    step1Error,
    fileInputRef,
    isStep1Valid,
    isSubmittingStep1,
    avatarUploadStatusLabel,
    setName,
    setAge,
    handleAvatarSelection,
    handleStep1Submit,
  } = useProfileSetup();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-secondary/20 p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-4xl border border-border bg-card shadow-xl"
      >
        <div className="h-2 w-full bg-primary" />

        <div className="p-8 md:p-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div>
              <h2 className="mb-2 text-3xl font-bold">{t("profile.setup_title")}</h2>
              <p className="text-muted-foreground">{t("profile.setup_description")}</p>
            </div>

            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="flex flex-col items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarSelection}
                />
                <div
                  className={cn(
                    "relative flex h-40 w-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-all",
                    photoUploaded
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary hover:bg-secondary",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoUploaded ? (
                    <>
                      <img
                        src={avatarPreview ?? profile?.profilePicUrl ?? ""}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <Camera className="size-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mb-2 size-8 text-muted-foreground" />
                      <span className="px-4 text-center text-sm font-medium text-muted-foreground">
                        {t("profile.upload_photo")}
                      </span>
                    </>
                  )}
                </div>
                {photoUploaded && (
                  <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                    <Check className="size-4" />
                    {avatarUploadStatusLabel}
                  </span>
                )}
              </div>

              <div className="w-full flex-1 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">{t("profile.your_name")}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("profile.name_placeholder")}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">{t("profile.age")}</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    placeholder="25"
                    min="18"
                    max="100"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {step1Error ? (
              <p className="text-sm font-medium text-destructive">{step1Error}</p>
            ) : null}

            <Button
              size="lg"
              className="mt-4 h-14 w-full rounded-2xl text-lg"
              disabled={!isStep1Valid || isSubmittingStep1}
              onClick={handleStep1Submit}
            >
              {isSubmittingStep1 ? t("common.saving") : t("common.continue")}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
