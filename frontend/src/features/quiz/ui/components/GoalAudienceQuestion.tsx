import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import type { Question } from "@/entities/quiz";
import { cn } from "@/shared/lib/utils";

import type { GoalAudienceState } from "../types";

type GoalAudienceQuestionProps = {
  question: Question;
  state?: GoalAudienceState;
  onChange: (nextState: GoalAudienceState) => void;
};

export function GoalAudienceQuestion({
  question,
  state,
  onChange,
}: GoalAudienceQuestionProps) {
  const { t } = useTranslation();
  const currentState: GoalAudienceState = state ?? {
    goal: null,
    audience: ["anyone"],
  };

  const goalOptions = question.options.filter((option) =>
    option.value.startsWith("goal:"),
  );
  const audienceOptions = question.options.filter((option) =>
    option.value.startsWith("audience:"),
  );

  const selectGoal = (value: string) => {
    const normalized = value.split(":", 2)[1] ?? null;
    onChange({
      ...currentState,
      goal: currentState.goal === normalized ? null : normalized,
    });
  };

  const toggleAudience = (value: string) => {
    const normalized = value.split(":", 2)[1];
    if (!normalized) {
      return;
    }

    if (normalized === "anyone") {
      onChange({
        ...currentState,
        audience: ["anyone"],
      });
      return;
    }

    const currentAudience = currentState.audience.filter((item) => item !== "anyone");
    const nextAudience = currentAudience.includes(normalized)
      ? currentAudience.filter((item) => item !== normalized)
      : [...currentAudience, normalized];

    onChange({
      ...currentState,
      audience: nextAudience.length > 0 ? nextAudience : ["anyone"],
    });
  };

  return (
    <div className="space-y-5 py-1">
      <section className="space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-primary/80 uppercase">
          {t("profile.goal_label")}
        </p>
        <div className="flex flex-wrap gap-2">
          {goalOptions.map((option, index) => {
            const normalized = option.value.split(":", 2)[1] ?? "";
            const isSelected = currentState.goal === normalized;
            return (
              <motion.button
                key={option.value}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => selectGoal(option.value)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                )}
              >
                {option.label}
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-primary/80 uppercase">
          {t("profile.audience_title")}
        </p>
        <div className="flex flex-wrap gap-2">
          {audienceOptions.map((option, index) => {
            const normalized = option.value.split(":", 2)[1] ?? "";
            const isSelected = currentState.audience.includes(normalized);
            return (
              <motion.button
                key={option.value}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + index * 0.02 }}
                onClick={() => toggleAudience(option.value)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {option.label}
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
