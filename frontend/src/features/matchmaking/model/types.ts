import type {
  CurrentUserPreview,
  MatchChatMessage,
  MatchProfile,
  MatchProfileId,
  MatchmakingDraft,
} from "@/entities/match-profile/model";

export type MatchmakingFlowContextValue = {
  currentProfile: MatchProfile | null;
  matchedProfile: MatchProfile | null;
  activeChatProfile: MatchProfile | null;
  chatProfiles: MatchProfile[];
  currentUserPreview: CurrentUserPreview;
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
  isFeedLoading: boolean;
  isReactionPending: boolean;
  messages: MatchChatMessage[];
  setDraft: (draft: MatchmakingDraft) => void;
  completeOnboarding: (draft: MatchmakingDraft) => void;
  passCurrentProfile: () => Promise<void>;
  likeCurrentProfile: () => Promise<{
    isMatch: boolean;
    profile: MatchProfile | null;
  }>;
  resetDiscovery: () => void;
  openChat: (profileId: MatchProfileId) => void;
  closeMatch: () => void;
  sendMessage: (profileId: MatchProfileId, text: string) => void;
  reportProfile: (profileId: MatchProfileId) => void;
};

export type PersistedMatchmakingState = {
  draft: MatchmakingDraft;
  isOnboardingComplete: boolean;
};
