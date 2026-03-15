export type MatchmakingFlowContextValue = {
  isOnboardingComplete: boolean;
  completeOnboarding: () => void;
};

export type PersistedMatchmakingState = {
  isOnboardingComplete: boolean;
};
