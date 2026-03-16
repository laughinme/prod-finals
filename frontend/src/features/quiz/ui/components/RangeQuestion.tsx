import { useTranslation } from "react-i18next";

import type { Question } from "@/entities/quiz";

type RangeQuestionProps = {
  question: Question;
  currentAnswer: string[];
  onChange: (value: string[]) => void;
};

export function RangeQuestion({ question, currentAnswer, onChange }: RangeQuestionProps) {
  const { t } = useTranslation();

  const minVal = question.rangeMin ?? 0;
  const maxVal = question.rangeMax ?? 100;

  const currentMin = currentAnswer[0] ? Number(currentAnswer[0]) : minVal;
  const currentMax = currentAnswer[1] ? Number(currentAnswer[1]) : maxVal;

  const handleMinChange = (value: string) => {
    const nextMin = Math.min(Number(value), currentMax);
    onChange([String(nextMin), String(currentMax)]);
  };

  const handleMaxChange = (value: string) => {
    const nextMax = Math.max(Number(value), currentMin);
    onChange([String(currentMin), String(nextMax)]);
  };

  return (
    <div className="flex flex-col gap-5 py-3 md:gap-8 md:py-6">
      <div className="space-y-3 md:space-y-4">
        <label className="text-sm font-medium text-muted-foreground flex justify-between">
          <span>{t("common.from")}</span>
          <span className="text-foreground font-bold">{currentMin}</span>
        </label>
        <input
          type="range"
          min={minVal}
          max={maxVal}
          value={currentMin}
          onChange={(event) => handleMinChange(event.target.value)}
          className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div className="space-y-3 md:space-y-4">
        <label className="text-sm font-medium text-muted-foreground flex justify-between">
          <span>{t("common.to")}</span>
          <span className="text-foreground font-bold">{currentMax}</span>
        </label>
        <input
          type="range"
          min={minVal}
          max={maxVal}
          value={currentMax}
          onChange={(event) => handleMaxChange(event.target.value)}
          className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground pt-2">
        <span>{question.rangeMinLabel || minVal}</span>
        <span>{question.rangeMaxLabel || maxVal}</span>
      </div>
    </div>
  );
}
