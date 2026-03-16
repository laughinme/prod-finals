import type { MatchProfile } from "@/entities/match-profile/model";

export type ChatNavigationState = {
  matchedProfile?: MatchProfile;
  matchId?: string | null;
  conversationId?: string | null;
};
