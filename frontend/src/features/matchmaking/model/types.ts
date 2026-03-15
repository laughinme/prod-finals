import type { MatchmakingDraft } from "@/entities/match-profile/model";

export type MatchmakingFlowContextValue = {
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
  setDraft: (draft: MatchmakingDraft) => void;
  completeOnboarding: (draft: MatchmakingDraft) => void;
};

export type PersistedMatchmakingState = {
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
};
