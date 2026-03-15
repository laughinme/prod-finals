import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";

type QuizHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  currentStep: number;
  totalSteps: number;
  onSkipAll: () => void;
  skipDisabled?: boolean;
};

export function QuizHeader({
  title,
  description,
  currentStep,
  totalSteps,
  onSkipAll,
  skipDisabled = false,
}: QuizHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="text-sm font-semibold tracking-wider text-primary/80 uppercase">
          {t("quiz.question_step", { current: currentStep, total: totalSteps })}
        </span>
        <h2 className="mt-2 text-2xl md:text-3xl font-bold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        className="shrink-0 rounded-xl text-muted-foreground"
        disabled={skipDisabled}
        onClick={onSkipAll}
      >
        {t("common.skip_all")}
      </Button>
    </div>
  );
}
