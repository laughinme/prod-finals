import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getOnboardingConfig } from "@/shared/api/onboarding";
import { useUpdateProfile } from "@/features/profile/model/useProfile";
import type { User } from "@/entities/user/model";
import { FEED_REFRESH_EVENT } from "@/features/matchmaking/model/useFeed";

const ageFromBirthDate = (birthDate: string | null): number | null => {
  if (!birthDate) {
    return null;
  }
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const diff = Date.now() - parsed.getTime();
  return Math.max(18, Math.floor(diff / 31557600000));
};

const defaultAgeRange = (birthDate: string | null) => {
  const age = ageFromBirthDate(birthDate);
  if (age === null) {
    return { min: 18, max: 30 };
  }
  return {
    min: Math.max(18, age - 5),
    max: Math.min(99, age + 5),
  };
};

export function usePreferencesEditor(profile: User) {
  const { data: config, isLoading } = useQuery({
    queryKey: ["onboarding", "config"],
    queryFn: getOnboardingConfig,
  });

  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();
  const goalStep = config?.steps.find((step) => step.stepKey === "goal_and_audience");
  const interestStep = config?.steps.find(
    (step) => step.stepKey === "interests_and_bank_signal",
  );

  const [goal, setGoal] = useState<string | null>(profile.goal ?? null);
  const [audience, setAudience] = useState<string[]>(
    profile.lookingForGenders.length > 0 ? [...profile.lookingForGenders] : ["anyone"],
  );
  const [ageRange, setAgeRange] = useState(
    profile.ageRange ?? defaultAgeRange(profile.birthDate),
  );
  const [interests, setInterests] = useState<string[]>([...profile.interests]);
  const [importTransactions, setImportTransactions] = useState(
    profile.importTransactions,
  );

  useEffect(() => {
    setGoal(profile.goal ?? null);
    setAudience(
      profile.lookingForGenders.length > 0 ? [...profile.lookingForGenders] : ["anyone"],
    );
    setAgeRange(profile.ageRange ?? defaultAgeRange(profile.birthDate));
    setInterests([...profile.interests]);
    setImportTransactions(profile.importTransactions);
  }, [
    profile.ageRange,
    profile.birthDate,
    profile.goal,
    profile.importTransactions,
    profile.interests,
    profile.lookingForGenders,
  ]);

  const goalOptions = useMemo(
    () => goalStep?.options.filter((option) => option.value.startsWith("goal:")) ?? [],
    [goalStep?.options],
  );

  const audienceOptions = useMemo(
    () => goalStep?.options.filter((option) => option.value.startsWith("audience:")) ?? [],
    [goalStep?.options],
  );

  const interestOptions = interestStep?.options ?? [];

  const toggleAudience = (value: string) => {
    if (value === "anyone") {
      setAudience(["anyone"]);
      return;
    }
    setAudience((prev) => {
      const normalized = prev.filter((item) => item !== "anyone");
      const next = normalized.includes(value)
        ? normalized.filter((item) => item !== value)
        : [...normalized, value];
      return next.length > 0 ? next : ["anyone"];
    });
  };

  const toggleInterest = (value: string) => {
    setInterests((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  const hasChanges = useMemo(() => {
    const profileAudience =
      profile.lookingForGenders.length > 0 ? [...profile.lookingForGenders] : ["anyone"];
    const currentAudience = [...audience].sort().join(",");
    const previousAudience = [...profileAudience].sort().join(",");
    const currentInterests = [...interests].sort().join(",");
    const previousInterests = [...profile.interests].sort().join(",");
    const previousAgeRange = profile.ageRange ?? defaultAgeRange(profile.birthDate);

    return (
      (goal ?? null) !== (profile.goal ?? null) ||
      currentAudience !== previousAudience ||
      currentInterests !== previousInterests ||
      importTransactions !== profile.importTransactions ||
      ageRange.min !== previousAgeRange.min ||
      ageRange.max !== previousAgeRange.max
    );
  }, [
    ageRange.max,
    ageRange.min,
    audience,
    goal,
    importTransactions,
    interests,
    profile.ageRange,
    profile.birthDate,
    profile.goal,
    profile.importTransactions,
    profile.interests,
    profile.lookingForGenders,
  ]);

  const handleSave = async () => {
    await updateProfile({
      goal,
      lookingForGenders: audience.includes("anyone") ? [] : audience,
      ageRange,
      interests,
      importTransactions,
    });
    window.dispatchEvent(new Event(FEED_REFRESH_EVENT));
  };

  return {
    isLoading,
    isPending,
    hasChanges,
    goal,
    setGoal,
    audience,
    toggleAudience,
    ageRange,
    setAgeRange,
    interests,
    toggleInterest,
    importTransactions,
    setImportTransactions,
    goalOptions,
    audienceOptions,
    interestOptions,
    handleSave,
  };
}
