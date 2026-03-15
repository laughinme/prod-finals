import { useTranslation } from "react-i18next";

import type { Question } from "@/entities/quiz";
import type { MatchPreferencesState } from "../types";

type MatchPreferencesQuestionProps = {
  question: Question;
  state?: MatchPreferencesState;
  onChange: (nextState: MatchPreferencesState) => void;
};

export function MatchPreferencesQuestion({
  question,
  state,
  onChange,
}: MatchPreferencesQuestionProps) {
  const { t } = useTranslation();

  const minVal = question.rangeMin ?? 18;
  const maxVal = question.rangeMax ?? 99;

  const currentState: MatchPreferencesState = state ?? {
    genders: [],
    ageMin: minVal,
    ageMax: maxVal,
  };

  const toggleGender = (value: string) => {
    const nextGenders = currentState.genders.includes(value)
      ? currentState.genders.filter((item) => item !== value)
      : [...currentState.genders, value];

    onChange({
      ...currentState,
      genders: nextGenders,
    });
  };

  return (
    <div className="space-y-8 py-2">
      <div className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">
          {t("quiz.show_first")}
        </p>
        <div className="flex flex-wrap gap-3">
          {question.options.map((option) => {
            const isSelected = currentState.genders.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleGender(option.value)}
                className={
                  "rounded-2xl border px-4 py-3 text-sm font-medium transition-all " +
                  (isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground")
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-secondary/20 p-5">
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              <span>{t("common.from")}</span>
              <span className="text-foreground">{currentState.ageMin}</span>
            </label>
            <input
              type="range"
              min={minVal}
              max={maxVal}
              value={currentState.ageMin}
              onChange={(event) =>
                onChange({
                  ...currentState,
                  ageMin: Math.min(
                    Number(event.target.value),
                    currentState.ageMax,
                  ),
                })
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              <span>{t("common.to")}</span>
              <span className="text-foreground">{currentState.ageMax}</span>
            </label>
            <input
              type="range"
              min={minVal}
              max={maxVal}
              value={currentState.ageMax}
              onChange={(event) =>
                onChange({
                  ...currentState,
                  ageMax: Math.max(
                    Number(event.target.value),
                    currentState.ageMin,
                  ),
                })
              }
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
