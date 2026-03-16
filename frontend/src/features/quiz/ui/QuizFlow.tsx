import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import * as Sentry from "@sentry/react";

import type { Question } from "@/entities/quiz";
import { useOnboardingState } from "@/features/quiz/model";

import {
  getOnboardingConfig,
  postOnboardingAnswers,
  postOnboardingSkip,
} from "@/shared/api/onboarding";

import { ProfilePreviewStep } from "./ProfilePreviewStep";
import { QuizControls } from "./components/QuizControls";
import { QuizHeader } from "./components/QuizHeader";
import { QuizProgress } from "./components/QuizProgress";
import { QuizQuestionContent } from "./components/QuizQuestionContent";
import type { MatchPreferencesState } from "./types";

export function QuizFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [importTransactions, setImportTransactions] = useState<
    Record<string, boolean>
  >({});
  const [hasHydratedState, setHasHydratedState] = useState(false);

  const {
    data: onboardingState,
    isLoading: isStateLoading,
    isError: isStateError,
  } = useOnboardingState();

  const {
    data: config,
    isLoading: isConfigLoading,
    isError: isConfigError,
  } = useQuery({
    queryKey: ["onboarding", "config"],
    queryFn: getOnboardingConfig,
  });

  const answerMutation = useMutation({
    mutationFn: postOnboardingAnswers,
    onSuccess: (nextState) => {
      queryClient.setQueryData(["onboarding", "state"], {
        quizStarted: nextState.quizStarted,
        skipped: nextState.skipped,
        completed: nextState.completed,
        shouldShow: nextState.shouldShow,
        currentStepKey: nextState.currentStepKey,
        requiredProfileStepKey: nextState.requiredProfileStepKey,
        missingRequiredFields: nextState.missingRequiredFields,
        completedStepKeys: nextState.completedStepKeys,
        answersByStep: nextState.answersByStep,
      });
    },
  });

  const skipMutation = useMutation({
    mutationFn: postOnboardingSkip,
    onSuccess: (nextState) => {
      queryClient.setQueryData(["onboarding", "state"], nextState);
    },
  });

  const steps = useMemo(() => config?.steps || [], [config?.steps]);
  const question = steps[currentIndex] as Question | undefined;
  const isLastQuestion = currentIndex === steps.length - 1;

  const currentAnswer = useMemo(() => {
    if (!question) return [];
    return answers[question.stepKey] || [];
  }, [answers, question]);

  const currentMatchPreferences = useMemo<MatchPreferencesState | null>(() => {
    if (!question || question.stepKey !== "match_preferences") {
      return null;
    }

    const defaultAgeMin = question.rangeMin ?? 18;
    const defaultAgeMax = question.rangeMax ?? 99;
    const genders = currentAnswer
      .filter((item) => item.startsWith("gender:"))
      .map((item) => item.split(":", 2)[1]);
    const ageMin = Number(
      currentAnswer
        .find((item) => item.startsWith("age_min:"))
        ?.split(":", 2)[1] ?? defaultAgeMin,
    );
    const ageMax = Number(
      currentAnswer
        .find((item) => item.startsWith("age_max:"))
        ?.split(":", 2)[1] ?? defaultAgeMax,
    );

    return { genders, ageMin, ageMax };
  }, [currentAnswer, question]);

  const currentImportTransactions = useMemo(() => {
    if (!question?.importTransactionsEnabled) {
      return undefined;
    }
    return (
      importTransactions[question.stepKey] ??
      question.importTransactionsValue ??
      question.importTransactionsDefault ??
      true
    );
  }, [importTransactions, question]);

  useEffect(() => {
    if (!question?.importTransactionsEnabled) return;

    setImportTransactions((prev) => {
      if (question.stepKey in prev) return prev;
      return {
        ...prev,
        [question.stepKey]:
          question.importTransactionsValue ??
          question.importTransactionsDefault ??
          true,
      };
    });
  }, [question]);

  useEffect(() => {
    if (!config || !onboardingState || hasHydratedState) return;

    setAnswers(onboardingState.answersByStep);
    const nextIndex = Math.max(
      0,
      steps.findIndex(
        (step) => step.stepKey === onboardingState.currentStepKey,
      ),
    );
    setCurrentIndex(nextIndex === -1 ? 0 : nextIndex);
    setHasHydratedState(true);
  }, [config, onboardingState, hasHydratedState, steps]);

  useEffect(() => {
    if (!config || !onboardingState?.currentStepKey) return;

    const nextIndex = steps.findIndex(
      (step) => step.stepKey === onboardingState.currentStepKey,
    );
    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
    }
  }, [config, onboardingState?.currentStepKey, steps]);

  if (isConfigLoading || isStateLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isConfigError || isStateError) {
    return <Navigate to="/" replace />;
  }

  if (onboardingState?.currentStepKey === "photo_upload") {
    return <Navigate to="/photo-upload" replace />;
  }

  if (onboardingState?.currentStepKey === "profile_basics") {
    return <Navigate to="/profile" replace />;
  }

  if (onboardingState?.currentStepKey === "profile_preview") {
    return <ProfilePreviewStep />;
  }

  if (!onboardingState?.shouldShow) {
    return <Navigate to="/discovery" replace />;
  }

  if (!question && !isConfigLoading) {
    return <Navigate to="/discovery" replace />;
  }

  const handleAnswerChange = (value: string | string[]) => {
    if (!question) return;
    const finalValue = Array.isArray(value) ? value : [value];
    setAnswers((prev) => ({
      ...prev,
      [question.stepKey]: finalValue,
    }));
  };

  const updateMatchPreferencesAnswer = (nextState: MatchPreferencesState) => {
    if (!question || question.stepKey !== "match_preferences") return;

    handleAnswerChange([
      ...nextState.genders.map((gender) => `gender:${gender}`),
      `age_min:${nextState.ageMin}`,
      `age_max:${nextState.ageMax}`,
    ]);
  };

  const handleNext = async () => {
    if (!question) return;

    let finalAnswers = currentAnswer;

    if (question.stepType === "range") {
      const isOptionalEmpty = question.optional && finalAnswers.length === 0;
      const needsDefaultRange = finalAnswers.length < 2 && !isOptionalEmpty;

      if (needsDefaultRange) {
        const min = question.rangeMin ?? 18;
        const max = question.rangeMax ?? 99;
        finalAnswers = [String(min), String(max)];
      }

      if (finalAnswers.length >= 2 && finalAnswers[0] === finalAnswers[1]) {
        finalAnswers = [finalAnswers[0], finalAnswers[1] + " "];
      }
    }

    try {
      const nextState = await answerMutation.mutateAsync({
        stepKey: question.stepKey,
        answers: finalAnswers,
        importTransactions: question.importTransactionsEnabled
          ? currentImportTransactions
          : undefined,
      });

      if (nextState.currentStepKey) {
        const nextIndex = steps.findIndex(
          (step) => step.stepKey === nextState.currentStepKey,
        );
        if (nextIndex >= 0) {
          setCurrentIndex(nextIndex);
        }
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error("Failed to save answers", error);
    }
  };

  const handleSkipAll = async () => {
    try {
      await skipMutation.mutateAsync();
      navigate("/discovery", { replace: true });
    } catch (error) {
      Sentry.captureException(error);
      console.error("Failed to skip onboarding", error);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      navigate(-1);
    }
  };

  const isCurrentValid = () => {
    if (!question) return false;

    const count = currentAnswer.length;
    if (question.optional && count === 0) return true;

    if (question.stepType === "single_select") return count === 1;

    if (question.stepType === "multi_select") {
      const min = question.minAnswers ?? 1;
      const max = question.maxAnswers ?? question.options.length;
      return count >= min && count <= max;
    }

    if (question.stepType === "range") {
      if (count < 2) return true;
      return Number(currentAnswer[0]) <= Number(currentAnswer[1]);
    }

    return false;
  };

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-secondary/20 px-3 py-4 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xl md:rounded-4xl"
      >
        <QuizProgress currentIndex={currentIndex} totalSteps={steps.length} />

        <div className="p-5 md:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={question!.stepKey}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 md:space-y-8"
            >
              <QuizHeader
                title={question!.title}
                description={question!.description}
                currentStep={currentIndex + 1}
                totalSteps={steps.length}
                onSkipAll={handleSkipAll}
                skipDisabled={
                  answerMutation.isPending || skipMutation.isPending
                }
              />

              <div className="min-h-32 md:min-h-50">
                <QuizQuestionContent
                  question={question!}
                  currentAnswer={currentAnswer}
                  onAnswerChange={handleAnswerChange}
                  currentImportTransactions={currentImportTransactions}
                  onToggleImportTransactions={(value) =>
                    setImportTransactions((prev) => ({
                      ...prev,
                      [question!.stepKey]: value,
                    }))
                  }
                  matchPreferencesState={currentMatchPreferences}
                  onMatchPreferencesChange={updateMatchPreferencesAnswer}
                />
              </div>
            </motion.div>
          </AnimatePresence>

          <QuizControls
            onBack={currentIndex > 0 ? handleBack : undefined}
            onNext={handleNext}
            backLabel={t("common.back")}
            nextLabel={
              answerMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : isLastQuestion ? (
                t("common.finish")
              ) : currentAnswer.length === 0 ? (
                t("common.skip")
              ) : (
                t("common.continue")
              )
            }
            isBackDisabled={answerMutation.isPending}
            isNextDisabled={
              !isCurrentValid() ||
              answerMutation.isPending ||
              skipMutation.isPending
            }
            isNextLoading={answerMutation.isPending}
            className="mt-5 md:mt-8"
          />
        </div>
      </motion.div>
    </div>
  );
}
