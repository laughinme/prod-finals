import type { Question } from "@/entities/quiz";

import { InterestTagsQuestion } from "./InterestTagsQuestion";
import { MatchPreferencesQuestion } from "./MatchPreferencesQuestion";
import { MultiSelectQuestion } from "./MultiSelectQuestion";
import { RangeQuestion } from "./RangeQuestion";
import { SingleSelectQuestion } from "./SingleSelectQuestion";
import type { MatchPreferencesState } from "../types";

type QuizQuestionContentProps = {
  question: Question;
  currentAnswer: string[];
  onAnswerChange: (value: string | string[]) => void;
  currentImportTransactions?: boolean;
  onToggleImportTransactions?: (value: boolean) => void;
  matchPreferencesState?: MatchPreferencesState | null;
  onMatchPreferencesChange?: (value: MatchPreferencesState) => void;
};

export function QuizQuestionContent({
  question,
  currentAnswer,
  onAnswerChange,
  currentImportTransactions,
  onToggleImportTransactions,
  matchPreferencesState,
  onMatchPreferencesChange,
}: QuizQuestionContentProps) {
  if (question.stepKey === "match_preferences") {
    return (
      <MatchPreferencesQuestion
        question={question}
        state={matchPreferencesState ?? undefined}
        onChange={(nextState) => onMatchPreferencesChange?.(nextState)}
      />
    );
  }

  if (question.stepKey === "interests") {
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
