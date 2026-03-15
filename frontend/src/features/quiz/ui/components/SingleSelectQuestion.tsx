import type { Question } from "@/entities/quiz";
import { cn } from "@/shared/lib/utils";

type SingleSelectQuestionProps = {
  question: Question;
  currentAnswer: string[];
  onChange: (value: string) => void;
};

export function SingleSelectQuestion({
  question,
  currentAnswer,
  onChange,
}: SingleSelectQuestionProps) {
  return (
    <div className="flex flex-col gap-3">
      {question.options.map((option) => {
        const isSelected = currentAnswer.includes(option.value);

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border-2 px-5 py-4 text-left font-medium transition-all",
              isSelected
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
