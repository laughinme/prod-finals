import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { getOnboardingConfig } from "@/shared/api/onboarding";
import { useUpdateProfile } from "@/features/profile/useProfile";
import type { User } from "@/entities/user/model";
import type { Question } from "@/entities/quiz";
import { FEED_REFRESH_EVENT } from "@/features/matchmaking/model/useFeed";

type MatchPreferencesState = {
    genders: string[];
    ageMin: number;
    ageMax: number;
};

export function PreferencesEditor({ profile }: { profile: User }) {
    const { t } = useTranslation();

    const {
        data: config,
        isLoading,
    } = useQuery({
        queryKey: ["onboarding", "config"],
        queryFn: getOnboardingConfig,
    });

    const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [importTransactions, setImportTransactions] = useState<Record<string, boolean>>({});
    const [currentIndex, setCurrentIndex] = useState(0);

    const steps = config?.steps || [];
    const question = steps[currentIndex] as Question | undefined;

    const currentAnswer = useMemo(() => {
        if (!question) return [];
        return answers[question.stepKey] || [];
    }, [answers, question]);

    const currentMatchPreferences = useMemo<MatchPreferencesState | null>(() => {
        if (!question || question.stepKey !== "match_preferences") return null;
        const defaultAgeMin = question.rangeMin ?? 18;
        const defaultAgeMax = question.rangeMax ?? 99;
        const genders = currentAnswer
            .filter((item) => item.startsWith("gender:"))
            .map((item) => item.split(":", 2)[1]);
        const ageMin = Number(
            currentAnswer.find((item) => item.startsWith("age_min:"))?.split(":", 2)[1] ?? defaultAgeMin,
        );
        const ageMax = Number(
            currentAnswer.find((item) => item.startsWith("age_max:"))?.split(":", 2)[1] ?? defaultAgeMax,
        );
        return { genders, ageMin, ageMax };
    }, [currentAnswer, question]);

    const currentImportTransactions = useMemo(() => {
        if (!question?.importTransactionsEnabled) return undefined;
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
        if (!config?.steps?.length) return;

        const nextAnswers: Record<string, string[]> = {};
        nextAnswers.match_preferences = [
            ...profile.lookingForGenders.map((gender) => `gender:${gender}`),
            `age_min:${profile.ageRange?.min ?? 18}`,
            `age_max:${profile.ageRange?.max ?? 99}`,
        ];
        nextAnswers.interests = [...profile.interests];
        setAnswers(nextAnswers);
        setImportTransactions({ interests: profile.importTransactions });
    }, [
        config?.steps,
        profile.ageRange?.max,
        profile.ageRange?.min,
        profile.importTransactions,
        profile.interests,
        profile.lookingForGenders,
    ]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-primary" />
            </div>
        );
    }

    if (steps.length === 0) {
        return (
            <p className="py-8 text-center text-muted-foreground">
                {t("profile.no_preferences")}
            </p>
        );
    }

    const handleAnswerChange = (value: string | string[]) => {
        if (!question) return;
        const finalValue = Array.isArray(value) ? value : [value];
        setAnswers((prev) => ({ ...prev, [question.stepKey]: finalValue }));
    };

    const updateMatchPreferencesAnswer = (nextState: MatchPreferencesState) => {
        if (!question || question.stepKey !== "match_preferences") return;
        handleAnswerChange([
            ...nextState.genders.map((g) => `gender:${g}`),
            `age_min:${nextState.ageMin}`,
            `age_max:${nextState.ageMax}`,
        ]);
    };

    const handleSave = async () => {
        if (!question) return;

        const payload =
            question.stepKey === "match_preferences" && currentMatchPreferences
                ? {
                    lookingForGenders: currentMatchPreferences.genders,
                    ageRange: {
                        min: currentMatchPreferences.ageMin,
                        max: currentMatchPreferences.ageMax,
                    },
                }
                : question.stepKey === "interests"
                    ? {
                        interests: currentAnswer,
                        importTransactions: currentImportTransactions ?? true,
                    }
                    : null;

        if (!payload) return;

        try {
            await updateProfile(payload);
            window.dispatchEvent(new Event(FEED_REFRESH_EVENT));
        } catch {
            // handled in profile mutation hook
        }
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
            updateMatchPreferencesAnswer({ ...state, genders: nextGenders });
        };

        const minVal = q.rangeMin ?? 18;
        const maxVal = q.rangeMax ?? 99;

        return (
            <div className="space-y-6">
                <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                        {t("profile.who_to_show")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {q.options.map((option) => {
                            const isSelected = state.genders.includes(option.value);
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => toggleGender(option.value)}
                                    className={cn(
                                        "rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                                        isSelected
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border bg-background text-muted-foreground hover:border-primary/40",
                                    )}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                                <span>{t("common.from")}</span>
                                <span className="text-foreground">{state.ageMin}</span>
                            </label>
                            <input
                                type="range"
                                min={minVal}
                                max={maxVal}
                                value={state.ageMin}
                                onChange={(e) =>
                                    updateMatchPreferencesAnswer({
                                        ...state,
                                        ageMin: Math.min(Number(e.target.value), state.ageMax),
                                    })
                                }
                                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                                <span>{t("common.to")}</span>
                                <span className="text-foreground">{state.ageMax}</span>
                            </label>
                            <input
                                type="range"
                                min={minVal}
                                max={maxVal}
                                value={state.ageMax}
                                onChange={(e) =>
                                    updateMatchPreferencesAnswer({
                                        ...state,
                                        ageMax: Math.max(Number(e.target.value), state.ageMin),
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

    const renderInterestTags = (q: Question) => {
        const toggleOption = (value: string) => {
            if (currentAnswer.includes(value)) {
                handleAnswerChange(currentAnswer.filter((item) => item !== value));
                return;
            }
            if (q.maxAnswers && currentAnswer.length >= q.maxAnswers) return;
            handleAnswerChange([...currentAnswer, value]);
        };

        return (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {q.options.map((option) => {
                        const isSelected = currentAnswer.includes(option.value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleOption(option.value)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                                    isSelected
                                        ? "border-primary bg-primary/10 text-foreground"
                                        : "border-border bg-background text-muted-foreground hover:border-primary/40",
                                )}
                            >
                                <span>{option.label}</span>
                                <span
                                    className={cn(
                                        "flex size-4 items-center justify-center rounded-full border text-[9px]",
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
                            "w-full rounded-2xl border p-4 text-left transition-all",
                            currentImportTransactions
                                ? "border-primary/40 bg-primary/10"
                                : "border-border/50 bg-secondary/35",
                        )}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">
                                {t("profile.ml_recommendations_label")}
                            </p>
                            <span
                                className={cn(
                                    "inline-flex h-6 w-10 shrink-0 items-center rounded-full border px-0.5 transition-colors",
                                    currentImportTransactions
                                        ? "border-primary bg-primary justify-end"
                                        : "border-border bg-background justify-start",
                                )}
                            >
                                <span className="size-4.5 rounded-full bg-white shadow-sm" />
                            </span>
                        </div>
                    </button>
                )}
            </div>
        );
    };

    const renderSingleSelect = (q: Question) => (
        <div className="flex flex-col gap-2">
            {q.options.map((option) => {
                const isSelected = currentAnswer.includes(option.value);
                return (
                    <button
                        key={option.value}
                        onClick={() => handleAnswerChange(option.value)}
                        className={cn(
                            "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all",
                            isSelected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40",
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );

    const renderQuestion = (q: Question) => {
        if (q.stepKey === "match_preferences") return renderMatchPreferences(q);
        if (q.stepKey === "interests") return renderInterestTags(q);
        if (q.stepType === "single_select") return renderSingleSelect(q);
        if (q.stepType === "multi_select") return renderInterestTags(q);
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Step tabs */}
            <div className="flex gap-4 overflow-x-auto border-b border-border/40">
                {steps.map((step, idx) => (
                    <button
                        key={step.stepKey}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={cn(
                            "shrink-0 border-b-2 px-1 py-2 text-sm font-medium transition-colors",
                            idx === currentIndex
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {step.title}
                    </button>
                ))}
            </div>

            {question && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold">{question.title}</h3>
                        {question.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{question.description}</p>
                        )}
                    </div>

                    {renderQuestion(question)}

                    <Button
                        className="h-11 rounded-xl px-8 font-semibold"
                        onClick={handleSave}
                        disabled={isPending || currentAnswer.length === 0}
                    >
                        {isPending ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            t("common.save")
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
