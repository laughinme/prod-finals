export type MatchmakingFlowContextValue = {
  isOnboardingComplete: boolean;
  completeOnboarding: () => void;
  setIsOnboardingComplete: (value: boolean) => void;
};
