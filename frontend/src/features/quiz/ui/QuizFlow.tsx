import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import * as Sentry from "@sentry/react";

import type { Question } from "@/entities/quiz";
import { useOnboardingState } from "@/features/quiz/model";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  getOnboardingConfig,
  postOnboardingAnswers,
  postOnboardingSkip,
} from "@/shared/api/onboarding";
import { ProfilePreviewStep } from "./ProfilePreviewStep";

type MatchPreferencesState = {
  genders: string[];
  ageMin: number;
  ageMax: number;
};

export function QuizFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [importTransactions, setImportTransactions] = useState<Record<string, boolean>>({});
  const [showProfilePreview, setShowProfilePreview] = useState(false);
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

  const steps = config?.steps || [];
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
      currentAnswer.find((item) => item.startsWith("age_min:"))?.split(":", 2)[1] ??
        defaultAgeMin,
    );
    const ageMax = Number(
      currentAnswer.find((item) => item.startsWith("age_max:"))?.split(":", 2)[1] ??
        defaultAgeMax,
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
    if (!question?.importTransactionsEnabled) {
      return;
    }

    setImportTransactions((prev) => {
      if (question.stepKey in prev) {
        return prev;
      }
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
    if (!config || !onboardingState || hasHydratedState) {
      return;
    }

    setAnswers(onboardingState.answersByStep);
    const nextIndex = Math.max(
      0,
      steps.findIndex((step) => step.stepKey === onboardingState.currentStepKey),
    );
    setCurrentIndex(nextIndex === -1 ? 0 : nextIndex);
    setHasHydratedState(true);
  }, [config, onboardingState, hasHydratedState, steps]);

  useEffect(() => {
    if (!config || !onboardingState?.currentStepKey) {
      return;
    }
    const nextIndex = steps.findIndex((step) => step.stepKey === onboardingState.currentStepKey);
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

  if (!onboardingState?.shouldShow) {
    return <Navigate to="/discovery" replace />;
  }

  if (!question && !isConfigLoading) {
    return <Navigate to="/discovery" replace />;
  }

  if (showProfilePreview) {
    return <ProfilePreviewStep />;
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
    if (!question || question.stepKey !== "match_preferences") {
      return;
    }

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
      if (finalAnswers.length < 2) {
        if (question.optional && finalAnswers.length === 0) {
          // Handled below
        } else {
          const min = question.rangeMin ?? 18;
          const max = question.rangeMax ?? 99;
          finalAnswers = [String(min), String(max)];
        }
      }

      // Bypass backend set[str] deduplication if values are identical
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

      if (nextState.completed) {
        setShowProfilePreview(true);
        return;
      }

      if (nextState.currentStepKey) {
        const nextIndex = steps.findIndex((step) => step.stepKey === nextState.currentStepKey);
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
  const renderSingleSelect = (q: Question) => {
    return (
      <div className="flex flex-col gap-3">
        {q.options.map((option) => {
          const isSelected = currentAnswer.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => handleAnswerChange(option.value)}
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
  };

  const renderInterestTags = (q: Question) => {
    const toggleOption = (value: string) => {
      if (currentAnswer.includes(value)) {
        handleAnswerChange(currentAnswer.filter((item) => item !== value));
        return;
      }
      if (q.maxAnswers && currentAnswer.length >= q.maxAnswers) {
        return;
      }
      handleAnswerChange([...currentAnswer, value]);
    };

    return (
      <div className="space-y-6 py-2">
        <div className="flex flex-wrap gap-3">
          {q.options.map((option) => {
            const isSelected = currentAnswer.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground shadow-sm"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <span>{option.label}</span>
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-[10px]",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent",
                  )}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {q.importTransactionsEnabled && (
          <button
            type="button"
            onClick={() =>
              setImportTransactions((prev) => ({
                ...prev,
                [q.stepKey]: !currentImportTransactions,
              }))
            }
            className={cn(
              "w-full rounded-3xl border p-5 text-left transition-all",
              currentImportTransactions
                ? "border-primary/40 bg-primary/10 shadow-sm"
                : "border-border/50 bg-secondary/35",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Использовать транзакции для ML-рекомендаций
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Помогаем модели точнее понять ваш ритм жизни по агрегированным
                  банковским транзакциям. По умолчанию согласие включено.
                </p>
              </div>
              <span
                className={cn(
                  "mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border px-1 transition-colors",
                  currentImportTransactions
                    ? "border-primary bg-primary justify-end"
                    : "border-border bg-background justify-start",
                )}
              >
                <span className="size-5 rounded-full bg-white shadow-sm" />
              </span>
            </div>
          </button>
        )}
      </div>
    );
  };

  const renderMatchPreferences = (q: Question) => {
    const state = currentMatchPreferences ?? {
      genders: [],
      ageMin: q.rangeMin ?? 18,
      ageMax: q.rangeMax ?? 99,
    };

    const toggleGender = (value: string) => {
      const nextGenders = state.genders.includes(value)
        ? state.genders.filter((item) => item !== value)
        : [...state.genders, value];
      updateMatchPreferencesAnswer({
        ...state,
        genders: nextGenders,
      });
    };

    const minVal = q.rangeMin ?? 18;
    const maxVal = q.rangeMax ?? 99;

    return (
      <div className="space-y-8 py-2">
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            Кого показывать в первую очередь
          </p>
          <div className="flex flex-wrap gap-3">
            {q.options.map((option) => {
              const isSelected = state.genders.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleGender(option.value)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-medium transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-secondary/20 p-5">
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>От</span>
                <span className="text-foreground">{state.ageMin}</span>
              </label>
              <input
                type="range"
                min={minVal}
                max={maxVal}
                value={state.ageMin}
                onChange={(event) =>
                  updateMatchPreferencesAnswer({
                    ...state,
                    ageMin: Math.min(Number(event.target.value), state.ageMax),
                  })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>{t("common.to")}</span>
                <span className="text-foreground">{state.ageMax}</span>
              </label>
              <input
                type="range"
                min={minVal}
                max={maxVal}
                value={state.ageMax}
                onChange={(event) =>
                  updateMatchPreferencesAnswer({
                    ...state,
                    ageMax: Math.max(Number(event.target.value), state.ageMin),
                  })
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMultiSelect = (q: Question) => {
    const toggleOption = (val: string) => {
      if (currentAnswer.includes(val)) {
        handleAnswerChange(currentAnswer.filter((x) => x !== val));
      } else {
        handleAnswerChange([...currentAnswer, val]);
      }
    };

    return (
      <div className="flex flex-col gap-3">
        {q.options.map((option) => {
          const isSelected = currentAnswer.includes(option.value);
          return (
            <button
              key={option.value}
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
        {(q.minAnswers || q.maxAnswers) && (
          <p className="text-xs text-muted-foreground mt-2">
            {q.minAnswers && `Min: ${q.minAnswers} `}
            {q.maxAnswers && `Max: ${q.maxAnswers}`}
          </p>
        )}
      </div>
    );
  };

  const renderRange = (q: Question) => {
    const minVal = q.rangeMin ?? 0;
    const maxVal = q.rangeMax ?? 100;

    const currentMin = currentAnswer[0] ? Number(currentAnswer[0]) : minVal;
    const currentMax = currentAnswer[1] ? Number(currentAnswer[1]) : maxVal;

    const handleMinChange = (v: string) => {
      const newMin = Math.min(Number(v), currentMax);
      handleAnswerChange([String(newMin), String(currentMax)]);
    };

    const handleMaxChange = (v: string) => {
      const newMax = Math.max(Number(v), currentMin);
      handleAnswerChange([String(currentMin), String(newMax)]);
    };

    return (
      <div className="flex flex-col gap-8 py-6">
        <div className="space-y-4">
          <label className="text-sm font-medium text-muted-foreground flex justify-between">
            <span>От:</span>
            <span className="text-foreground font-bold">{currentMin}</span>
          </label>
          <input
            type="range"
            min={minVal}
            max={maxVal}
            value={currentMin}
            onChange={(e) => handleMinChange(e.target.value)}
            className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-4">
          <label className="text-sm font-medium text-muted-foreground flex justify-between">
            <span>{t("common.to")}</span>
            <span className="text-foreground font-bold">{currentMax}</span>
          </label>
          <input
            type="range"
            min={minVal}
            max={maxVal}
            value={currentMax}
            onChange={(e) => handleMaxChange(e.target.value)}
            className="w-full accent-primary h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex justify-between text-xs text-muted-foreground pt-2">
          <span>{q.rangeMinLabel || minVal}</span>
          <span>{q.rangeMaxLabel || maxVal}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-secondary/20 p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-4xl border border-border bg-card shadow-xl"
      >
        <div className="h-2 w-full bg-secondary">
          <motion.div
            className="h-full bg-primary"
            initial={{
              width: `${(currentIndex / (steps.length || 1)) * 100}%`,
            }}
            animate={{
              width: `${((currentIndex + 1) / (steps.length || 1)) * 100}%`,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={question!.stepKey}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-sm font-semibold tracking-wider text-primary/80 uppercase">
                    Вопрос {currentIndex + 1} из {steps.length}
                  </span>
                  <h2 className="mt-2 text-2xl md:text-3xl font-bold text-foreground">
                    {question!.title}
                  </h2>
                  {question!.description && (
                    <p className="mt-2 text-muted-foreground">
                      {question!.description}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 rounded-xl text-muted-foreground"
                  disabled={answerMutation.isPending || skipMutation.isPending}
                  onClick={handleSkipAll}
                >
                  Пропустить все
                </Button>
              </div>

              <div className="min-h-50">
                {question!.stepKey === "match_preferences" &&
                  renderMatchPreferences(question!)}
                {question!.stepKey === "interests" &&
                  renderInterestTags(question!)}
                {question!.stepKey !== "match_preferences" &&
                  question!.stepKey !== "interests" &&
                  question!.stepType === "single_select" &&
                  renderSingleSelect(question!)}
                {question!.stepKey !== "match_preferences" &&
                  question!.stepKey !== "interests" &&
                  question!.stepType === "multi_select" &&
                  renderMultiSelect(question!)}
                {question!.stepKey !== "match_preferences" &&
                  question!.stepKey !== "interests" &&
                  question!.stepType === "range" &&
                  renderRange(question!)}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex gap-4 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1 rounded-2xl"
              onClick={handleBack}
              disabled={answerMutation.isPending}
            >
              {t("common.back")}
            </Button>
              <Button
                size="lg"
                className="h-14 flex-2 rounded-2xl text-lg"
                disabled={!isCurrentValid() || answerMutation.isPending || skipMutation.isPending}
                onClick={handleNext}
              >
                {answerMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : isLastQuestion ? (
                  t("common.finish")
                ) : currentAnswer.length === 0 ? (
                  "Пропустить"
                ) : (
                  t("common.continue")
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
