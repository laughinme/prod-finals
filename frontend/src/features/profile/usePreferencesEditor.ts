import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getOnboardingConfig } from "@/shared/api/onboarding";
import { useUpdateProfile } from "@/features/profile/useProfile";
import type { User } from "@/entities/user/model";
import type { Question } from "@/entities/quiz";
import { FEED_REFRESH_EVENT } from "@/features/matchmaking/model/useFeed";

export type MatchPreferencesState = {
    genders: string[];
    ageMin: number;
    ageMax: number;
};

export function usePreferencesEditor(profile: User) {
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

    const steps = (config?.steps || []) as Question[];
    const question = steps[currentIndex];

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

    const handleAnswerChange = (value: string | string[]) => {
        if (!question) return;

        const finalValue = Array.isArray(value) ? value : [value];
        setAnswers((prev) => ({ ...prev, [question.stepKey]: finalValue }));
    };

    const updateMatchPreferencesAnswer = (nextState: MatchPreferencesState) => {
        if (!question || question.stepKey !== "match_preferences") return;

        handleAnswerChange([
            ...nextState.genders.map((gender) => `gender:${gender}`),
            `age_min:${nextState.ageMin}`,
            `age_max:${nextState.ageMax}`,
        ]);
    };

    const toggleImportTransactions = () => {
        if (!question?.importTransactionsEnabled) return;

        setImportTransactions((prev) => ({
            ...prev,
            [question.stepKey]: !currentImportTransactions,
        }));
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

    return {
        currentAnswer,
        currentImportTransactions,
        currentIndex,
        currentMatchPreferences,
        handleAnswerChange,
        handleSave,
        isLoading,
        isPending,
        isSaveDisabled: isPending || currentAnswer.length === 0,
        question,
        setCurrentIndex,
        steps,
        toggleImportTransactions,
        updateMatchPreferencesAnswer,
    };
}
