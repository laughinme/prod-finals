import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import * as Sentry from "@sentry/react";

import type { Question } from "@/entities/quiz";
import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { useQuizCompletion } from "@/features/quiz/model";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  getOnboardingConfig,
  postOnboardingAnswers,
} from "@/shared/api/onboarding";

export function QuizFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { completeOnboarding } = useMatchmakingFlow();
  const { markQuizCompleted } = useQuizCompletion();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

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
  });

  const steps = config?.steps || [];
  const question = steps[currentIndex] as Question | undefined;
  const isLastQuestion = currentIndex === steps.length - 1;

  const currentAnswer = useMemo(() => {
    if (!question) return [];
    return answers[question.stepKey] || [];
  }, [answers, question]);

  if (isConfigLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <Loader2 className="size-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isConfigError || (!question && !isConfigLoading)) {
    if (!isConfigLoading && config?.steps.length === 0) {
      markQuizCompleted();
      completeOnboarding();
      return <Navigate to="/discovery" replace />;
    }
    return <Navigate to="/" replace />;
  }

  const handleAnswerChange = (value: string | string[]) => {
    if (!question) return;
    const finalValue = Array.isArray(value) ? value : [value];
    setAnswers((prev) => ({
      ...prev,
      [question.stepKey]: finalValue,
    }));
  };

  const moveToNext = () => {
    if (isLastQuestion) {
      markQuizCompleted();
      completeOnboarding();
      navigate("/discovery", { replace: true });
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
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
      if (finalAnswers.length === 0 && question.optional) {
        moveToNext();
        return;
      }

      const response = await answerMutation.mutateAsync({
        stepKey: question.stepKey,
        answers: finalAnswers,
      });

      if (response.completed || isLastQuestion) {
        markQuizCompleted();
        completeOnboarding();
        navigate("/discovery", { replace: true });
      } else if (response.nextStepKey) {
        const nextIndex = steps.findIndex(
          (s) => s.stepKey === response.nextStepKey,
        );
        if (nextIndex !== -1) {
          setCurrentIndex(nextIndex);
        } else {
          moveToNext();
        }
      } else {
        moveToNext();
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error("Failed to save answers", error);
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
    if (question.optional) return true;

    const count = currentAnswer.length;

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

              <div className="min-h-50">
                {question!.stepType === "single_select" &&
                  renderSingleSelect(question!)}
                {question!.stepType === "multi_select" &&
                  renderMultiSelect(question!)}
                {question!.stepType === "range" && renderRange(question!)}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex gap-4 pt-4 border-t border-border/50">
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1 rounded-2xl text-lg"
              onClick={handleBack}
              disabled={answerMutation.isPending}
            >
              {t("common.back")}
            </Button>
            <Button
              size="lg"
              className="h-14 flex-1 rounded-2xl text-lg"
              disabled={!isCurrentValid() || answerMutation.isPending}
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
