import type { Question } from "@/entities/quiz";
import { cn } from "@/shared/lib/utils";

type MultiSelectQuestionProps = {
  question: Question;
  currentAnswer: string[];
  onChange: (value: string[]) => void;
};

export function MultiSelectQuestion({
  question,
  currentAnswer,
  onChange,
}: MultiSelectQuestionProps) {
  const toggleOption = (value: string) => {
    if (currentAnswer.includes(value)) {
      onChange(currentAnswer.filter((item) => item !== value));
    } else {
      onChange([...currentAnswer, value]);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {question.options.map((option) => {
        const isSelected = currentAnswer.includes(option.value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleOption(option.value)}
            className={cn(
              "rounded-xl border-2 px-5 py-4 text-left font-medium transition-all",
              isSelected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30",
                )}
              >
                {isSelected && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10 3L4.5 8.5L2 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span>{option.label}</span>
            </div>
          </button>
        );
      })}

      {(question.minAnswers || question.maxAnswers) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {question.minAnswers && `Min: ${question.minAnswers} `}
          {question.maxAnswers && `Max: ${question.maxAnswers}`}
        </p>
      )}
    </div>
  );
}
