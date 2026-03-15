import { type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useProfile } from "@/features/profile/useProfile";
import type { User } from "@/entities/user/model";

import { MatchmakingFlowContext } from "./useMatchmakingFlow";

const PROFILE_KEY = ["profile", "me"];

export function MatchmakingFlowProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const isOnboardingComplete = profile?.isOnboarded ?? false;

  const completeOnboarding = () => {
    queryClient.setQueryData<User>(PROFILE_KEY, (old) =>
      old ? { ...old, isOnboarded: true } : old,
    );
    queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
  };

  const setIsOnboardingComplete = (value: boolean) => {
    queryClient.setQueryData<User>(PROFILE_KEY, (old) =>
      old ? { ...old, isOnboarded: value } : old,
    );
    queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
  };

  return (
    <MatchmakingFlowContext.Provider
      value={{
        isOnboardingComplete,
        completeOnboarding,
        setIsOnboardingComplete,
      }}
    >
      {children}
    </MatchmakingFlowContext.Provider>
  );
}
