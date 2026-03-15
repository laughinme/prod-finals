export type MatchmakingFlowContextValue = {
  isOnboardingComplete: boolean;
  completeOnboarding: () => void;
  setIsOnboardingComplete: (value: boolean) => void;
};

export type PersistedMatchmakingState = {
  isOnboardingComplete: boolean;
};
