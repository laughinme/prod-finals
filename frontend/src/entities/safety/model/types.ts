export type SafetySourceContext =
  | "feed"
  | "match_list"
  | "conversation"
  | "profile";

export type BlockReasonCode =
  | "unwanted_contact"
  | "harassment"
  | "spam"
  | "other";

export type ReportCategory =
  | "harassment"
  | "spam"
  | "fake_profile"
  | "inappropriate_content"
  | "other";

export type BlockUserPayload = {
  targetUserId: string;
  sourceContext: SafetySourceContext;
  reasonCode: BlockReasonCode;
};

export type BlockUserResult = {
  status: "blocked";
  removedFromFutureFeed: boolean;
  conversationClosed: boolean | null;
  matchClosed: boolean | null;
};

export type BlockedUser = {
  blockId: string;
  targetUserId: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
  reasonCode: string;
  sourceContext: string;
};

export type BlockedUsersResult = {
  items: BlockedUser[];
};

export type UnblockUserResult = {
  status: "unblocked";
  removedFromBlocklist: boolean;
};

export type ReportUserPayload = {
  targetUserId: string;
  sourceContext: SafetySourceContext;
  category: ReportCategory;
  description?: string | null;
  relatedMessageId?: string | null;
  alsoBlock?: boolean;
};

export type ReportUserResult = {
  reportId: string;
  status: "accepted";
  alsoBlockApplied: boolean;
};
