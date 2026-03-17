import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
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
import type { GoalAudienceState } from "./types";

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

  const currentGoalAudience = useMemo<GoalAudienceState | null>(() => {
    if (!question || question.stepKey !== "goal_and_audience") {
      return null;
    }

    const goal =
      currentAnswer.find((item) => item.startsWith("goal:"))?.split(":", 2)[1] ??
      null;
    const audience = currentAnswer
      .filter((item) => item.startsWith("audience:"))
      .map((item) => item.split(":", 2)[1]);

    return { goal, audience: audience.length > 0 ? audience : ["anyone"] };
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

  const estimateCount = useMemo(() => {
    const baseByStep = [124, 67, 24];
    const base = baseByStep[currentIndex] ?? 18;
    if (!question) {
      return base;
    }

    const selectedAnswers = answers[question.stepKey]?.length ?? 0;
    const importBonus = importTransactions[question.stepKey] === false ? 4 : 0;
    return Math.max(18, base - selectedAnswers * 7 - importBonus);
  }, [answers, currentIndex, importTransactions, question]);

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

  const updateGoalAudienceAnswer = (nextState: GoalAudienceState) => {
    if (!question || question.stepKey !== "goal_and_audience") return;

    handleAnswerChange([
      ...(nextState.goal ? [`goal:${nextState.goal}`] : []),
      ...nextState.audience.map((audience) => `audience:${audience}`),
    ]);
  };

  const handleNext = async () => {
    if (!question) return;

    const finalAnswers = currentAnswer;

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
      const nextState = await skipMutation.mutateAsync();
      if (!nextState.shouldShow) {
        document.cookie = "t-match-show-swipe-hint=1;path=/;max-age=60";
      }
      navigate(nextState.shouldShow ? "/quiz" : "/discovery", { replace: true });
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

    if (question.stepKey === "goal_and_audience") return true;

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
                description={question!.subtitle ?? question!.description}
                currentStep={currentIndex + 1}
                totalSteps={steps.length}
                onSkipAll={handleSkipAll}
                skipDisabled={
                  answerMutation.isPending || skipMutation.isPending
                }
              />

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-primary/15 bg-linear-to-r from-primary/12 via-primary/6 to-transparent px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] text-primary/80 uppercase">
                      {t("quiz.estimate_label")}
                    </p>
                    <p className="text-lg font-semibold text-foreground md:text-2xl">
                      {t("quiz.estimate_found", {
                        count: estimateCount,
                      })}
                    </p>
                  </div>
                </div>
              </motion.div>

              <div className="min-h-20 md:min-h-32">
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
                  goalAudienceState={currentGoalAudience}
                  onGoalAudienceChange={updateGoalAudienceAnswer}
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
            className="mt-4 md:mt-6"
          />
        </div>
      </motion.div>
    </div>
  );
}
