import type { Question } from "@/entities/quiz";

import { GoalAudienceQuestion } from "./GoalAudienceQuestion";
import { InterestTagsQuestion } from "./InterestTagsQuestion";
import { MultiSelectQuestion } from "./MultiSelectQuestion";
import { RangeQuestion } from "./RangeQuestion";
import { SingleSelectQuestion } from "./SingleSelectQuestion";
import type { GoalAudienceState } from "../types";

type QuizQuestionContentProps = {
  question: Question;
  currentAnswer: string[];
  onAnswerChange: (value: string | string[]) => void;
  currentImportTransactions?: boolean;
  onToggleImportTransactions?: (value: boolean) => void;
  goalAudienceState?: GoalAudienceState | null;
  onGoalAudienceChange?: (value: GoalAudienceState) => void;
};

export function QuizQuestionContent({
  question,
  currentAnswer,
  onAnswerChange,
  currentImportTransactions,
  onToggleImportTransactions,
  goalAudienceState,
  onGoalAudienceChange,
}: QuizQuestionContentProps) {
  if (question.stepKey === "goal_and_audience") {
    return (
      <GoalAudienceQuestion
        question={question}
        state={goalAudienceState ?? undefined}
        onChange={(nextState) => onGoalAudienceChange?.(nextState)}
      />
    );
  }

  if (question.stepKey === "interests_and_bank_signal") {
    return (
      <InterestTagsQuestion
        question={question}
        currentAnswer={currentAnswer}
        onChange={(value) => onAnswerChange(value)}
        currentImportTransactions={currentImportTransactions}
        onToggleImportTransactions={onToggleImportTransactions}
      />
    );
  }

  if (question.stepType === "single_select") {
    return (
      <SingleSelectQuestion
        question={question}
        currentAnswer={currentAnswer}
        onChange={(value) => onAnswerChange(value)}
      />
    );
  }

  if (question.stepType === "multi_select") {
    return (
      <MultiSelectQuestion
        question={question}
        currentAnswer={currentAnswer}
        onChange={(value) => onAnswerChange(value)}
      />
    );
  }

  if (question.stepType === "range") {
    return (
      <RangeQuestion
        question={question}
        currentAnswer={currentAnswer}
        onChange={(value) => onAnswerChange(value)}
      />
    );
  }

  return null;
}
