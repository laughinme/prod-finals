export type MatchStatus = "active" | "closed" | "blocked";

export type CloseMatchReasonCode =
  | "not_interested"
  | "conversation_finished"
  | "other";

export type MatchListItem = {
  matchId: string;
  candidateUserId: string;
  displayName: string;
  avatarUrl: string;
  conversationId: string | null;
  status: MatchStatus;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ClosedMatchResult = {
  status: string;
  removedFromFutureFeed: boolean;
};
