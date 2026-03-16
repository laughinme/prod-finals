import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

type QuizControlsProps = {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: ReactNode;
  backLabel: ReactNode;
  className?: string;
  isNextDisabled?: boolean;
  isBackDisabled?: boolean;
  isNextLoading?: boolean;
  isBackLoading?: boolean;
};

export function QuizControls({
  onBack,
  onNext,
  nextLabel,
  backLabel,
  className,
  isNextDisabled,
  isBackDisabled,
  isNextLoading,
  isBackLoading,
}: QuizControlsProps) {
  return (
    <div
      className={cn(
        "mt-8 flex gap-3 pt-4 border-t border-border/50 md:gap-4",
        className,
      )}
    >
      {onBack && (
        <Button
          variant="outline"
          size="lg"
          className="h-11 flex-1 rounded-xl text-sm md:h-14 md:rounded-2xl md:text-lg"
          onClick={onBack}
          disabled={isBackDisabled || isBackLoading}
        >
          {isBackLoading ? <Loader2 className="animate-spin" /> : backLabel}
        </Button>
      )}

      <Button
        size="lg"
        className="h-11 flex-1 rounded-xl text-sm md:h-14 md:rounded-2xl md:text-lg"
        onClick={onNext}
        disabled={isNextDisabled || isNextLoading}
      >
        {isNextLoading ? <Loader2 className="animate-spin" /> : nextLabel}
      </Button>
    </div>
  );
}
