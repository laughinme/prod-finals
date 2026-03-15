import { motion } from "motion/react";

type QuizProgressProps = {
  currentIndex: number;
  totalSteps: number;
  duration?: number;
};

export function QuizProgress({
  currentIndex,
  totalSteps,
  duration = 0.3,
}: QuizProgressProps) {
  const safeTotal = Math.max(totalSteps, 1);
  const progress = ((currentIndex + 1) / safeTotal) * 100;

  return (
    <div
      className="h-2 w-full bg-secondary"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <motion.div
        className="h-full bg-primary"
        initial={{ width: `${(currentIndex / safeTotal) * 100}%` }}
        animate={{ width: `${progress}%` }}
        transition={{ duration }}
      />
    </div>
  );
}
