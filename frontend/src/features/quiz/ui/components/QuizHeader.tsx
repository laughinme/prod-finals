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
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className="text-xs font-semibold tracking-wider text-primary/80 uppercase md:text-sm">
          {t("quiz.question_step", { current: currentStep, total: totalSteps })}
        </span>
        <h2 className="mt-1 text-xl font-bold text-foreground md:mt-2 md:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground md:mt-2 md:text-base">{description}</p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 rounded-xl text-xs text-muted-foreground md:text-sm"
        disabled={skipDisabled}
        onClick={onSkipAll}
      >
        {t("common.skip_all")}
      </Button>
    </div>
  );
}
