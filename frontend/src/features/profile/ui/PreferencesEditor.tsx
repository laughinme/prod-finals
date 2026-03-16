import type { Dispatch, SetStateAction } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { User } from "@/entities/user/model";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { usePreferencesEditor } from "@/features/profile/model/usePreferencesEditor";

export function PreferencesEditor({ profile }: { profile: User }) {
  const { t } = useTranslation();
  const {
    isLoading,
    isPending,
    hasChanges,
    goal,
    setGoal,
    audience,
    toggleAudience,
    ageRange,
    setAgeRange,
    interests,
    toggleInterest,
    importTransactions,
    setImportTransactions,
    goalOptions,
    audienceOptions,
    interestOptions,
    handleSave,
  } = usePreferencesEditor(profile);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.24em] text-primary/80 uppercase">
            {t("profile.goal_label")}
          </p>
          <h3 className="text-xl font-bold">{t("profile.goal_title")}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((option) => {
            const normalized = option.value.split(":", 2)[1] ?? "";
            const selected = goal === normalized;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setGoal(selected ? null : normalized)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="space-y-4 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.24em] text-primary/80 uppercase">
            {t("profile.who_to_show")}
          </p>
          <h3 className="text-xl font-bold">{t("profile.audience_title")}</h3>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {audienceOptions.map((option) => {
            const normalized = option.value.split(":", 2)[1] ?? "";
            const selected = audience.includes(normalized);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleAudience(normalized)}
                className={cn(
                  "rounded-full border px-4 py-2.5 text-sm font-medium transition-all",
                  selected
                    ? "border-primary bg-primary/10 text-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-5 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.24em] text-primary/80 uppercase">
            {t("profile.age_range_title")}
          </p>
          <h3 className="text-xl font-bold">{t("profile.age_range_description")}</h3>
        </div>

        <DualRangeSlider value={ageRange} onChange={setAgeRange} />
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="space-y-4 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.24em] text-primary/80 uppercase">
            {t("profile.interests_title")}
          </p>
          <h3 className="text-xl font-bold">{t("profile.interests_description")}</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {interestOptions.map((option) => {
            const selected = interests.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleInterest(option.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40",
                )}
              >
                <span>{option.label}</span>
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border text-[9px]",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent",
                  )}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setImportTransactions((prev) => !prev)}
          className={cn(
            "w-full rounded-2xl border p-4 text-left transition-all",
            importTransactions
              ? "border-primary/40 bg-primary/10"
              : "border-border/50 bg-secondary/35",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("profile.ml_recommendations_label")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("profile.ml_recommendations_description")}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-6 w-10 shrink-0 items-center rounded-full border px-0.5 transition-colors",
                importTransactions
                  ? "border-primary bg-primary justify-end"
                  : "border-border bg-background justify-start",
              )}
            >
              <span className="size-4.5 rounded-full bg-white shadow-sm" />
            </span>
          </div>
        </button>
      </motion.section>

      <div className="flex justify-end">
        <Button
          size="lg"
          className="min-w-44 rounded-2xl"
          disabled={!hasChanges || isPending}
          onClick={() => void handleSave()}
        >
          {isPending ? <Loader2 className="animate-spin" /> : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function DualRangeSlider({
  value,
  onChange,
}: {
  value: { min: number; max: number };
  onChange: Dispatch<SetStateAction<{ min: number; max: number }>>;
}) {
  const minPercent = ((value.min - 18) / (99 - 18)) * 100;
  const maxPercent = ((value.max - 18) / (99 - 18)) * 100;

  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
      <div className="mb-4 flex items-center justify-between text-sm font-medium">
        <span className="rounded-full bg-background px-3 py-1 text-muted-foreground">
          {value.min}
        </span>
        <span className="text-muted-foreground">—</span>
        <span className="rounded-full bg-background px-3 py-1 text-muted-foreground">
          {value.max}
        </span>
      </div>

      <div className="relative h-10">
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-border/60" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(maxPercent - minPercent, 2)}%`,
          }}
        />

        <input
          type="range"
          min={18}
          max={99}
          value={value.min}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              min: Math.min(Number(e.target.value), prev.max),
            }))
          }
          className="pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow"
        />
        <input
          type="range"
          min={18}
          max={99}
          value={value.max}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              max: Math.max(Number(e.target.value), prev.min),
            }))
          }
          className="pointer-events-none absolute inset-0 h-10 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow"
        />
      </div>
    </div>
  );
}
