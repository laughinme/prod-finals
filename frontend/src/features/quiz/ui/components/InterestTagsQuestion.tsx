import { useTranslation } from "react-i18next";

import type { Question } from "@/entities/quiz";
import { cn } from "@/shared/lib/utils";

type InterestTagsQuestionProps = {
  question: Question;
  currentAnswer: string[];
  onChange: (value: string[]) => void;
  currentImportTransactions?: boolean;
  onToggleImportTransactions?: (value: boolean) => void;
};

export function InterestTagsQuestion({
  question,
  currentAnswer,
  onChange,
  currentImportTransactions,
  onToggleImportTransactions,
}: InterestTagsQuestionProps) {
  const { t } = useTranslation();

  const toggleOption = (value: string) => {
    if (currentAnswer.includes(value)) {
      onChange(currentAnswer.filter((item) => item !== value));
      return;
    }
    if (question.maxAnswers && currentAnswer.length >= question.maxAnswers) {
      return;
    }
    onChange([...currentAnswer, value]);
  };

  const canToggleImport =
    question.importTransactionsEnabled &&
    typeof currentImportTransactions === "boolean" &&
    onToggleImportTransactions;

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap gap-3">
        {question.options.map((option) => {
          const isSelected = currentAnswer.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleOption(option.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
                isSelected
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span>{option.label}</span>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px]",
                  isSelected
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

      {canToggleImport && (
        <button
          type="button"
          onClick={() => onToggleImportTransactions(!currentImportTransactions)}
          className={cn(
            "w-full rounded-3xl border p-5 text-left transition-all",
            currentImportTransactions
              ? "border-primary/40 bg-primary/10 shadow-sm"
              : "border-border/50 bg-secondary/35",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {t("profile.ml_recommendations_label")}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("profile.ml_recommendations_description")}
              </p>
            </div>
            <span
              className={cn(
                "mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border px-1 transition-colors",
                currentImportTransactions
                  ? "border-primary bg-primary justify-end"
                  : "border-border bg-background justify-start",
              )}
            >
              <span className="size-5 rounded-full bg-white shadow-sm" />
            </span>
          </div>
        </button>
      )}
    </div>
  );
}
