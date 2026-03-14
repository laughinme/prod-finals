import { motion } from "motion/react";
import { Camera, Check, UploadCloud } from "lucide-react";

import { MATCHMAKING_INTERESTS } from "@/entities/match-profile/model";
import { useProfileSetup } from "@/pages/ProfileSetup/model";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export default function ProfileSetupPage() {
  const {
    profile,
    step,
    photoUploaded,
    name,
    age,
    selectedInterests,
    avatarPreview,
    step1Error,
    fileInputRef,
    isStep1Valid,
    isStep2Valid,
    isSubmittingStep1,
    avatarUploadStatusLabel,
    setName,
    setAge,
    setStep,
    toggleInterest,
    handleAvatarSelection,
    handleStep1Submit,
    handleComplete,
  } = useProfileSetup();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-secondary/20 p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-4xl border border-border bg-card shadow-xl"
      >
        <div className="h-2 w-full bg-secondary">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "50%" }}
            animate={{ width: step === 1 ? "50%" : "100%" }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-8 md:p-12">
          {step === 1 ? (
            <motion.div
              key="profile-step-1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div>
                <h2 className="mb-2 text-3xl font-bold">Создание профиля</h2>
                <p className="text-muted-foreground">
                  Расскажите немного о себе. Фото и базовое описание
                  обязательны.
                </p>
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
                          Загрузить фото
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
                    <label className="text-sm font-semibold">Ваше имя</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Например, Александр"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Возраст</label>
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
                <p className="text-sm font-medium text-destructive">
                  {step1Error}
                </p>
              ) : null}

              <Button
                size="lg"
                className="mt-4 h-14 w-full rounded-2xl text-lg"
                disabled={!isStep1Valid || isSubmittingStep1}
                onClick={handleStep1Submit}
              >
                {isSubmittingStep1 ? "Сохранение..." : "Продолжить"}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="profile-step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div>
                <h2 className="mb-2 text-3xl font-bold">Ваши интересы</h2>
                <p className="text-muted-foreground">
                  Выберите от 3 до 5 тегов. Это поможет нам точнее находить
                  совпадения по образу жизни.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {MATCHMAKING_INTERESTS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);

                  return (
                    <button
                      key={interest}
                      onClick={() => toggleInterest(interest)}
                      className={cn(
                        "rounded-xl border-2 px-5 py-3 text-sm font-medium transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-start gap-4 rounded-2xl bg-secondary/50 p-5">
                <div className="shrink-0 rounded-lg border border-border bg-background p-2">
                  <Check className="size-5 text-primary" />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Мы также используем агрегированные данные о ваших привычках,
                  чтобы сделать рекомендации еще точнее. Это 100% безопасно и
                  приватно.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 flex-1 rounded-2xl"
                  onClick={() => setStep(1)}
                >
                  Назад
                </Button>
                <Button
                  size="lg"
                  className="h-14 flex-4xl rounded-2xl text-lg"
                  disabled={!isStep2Valid}
                  onClick={handleComplete}
                >
                  Начать знакомства
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
