export type MatchProfileId = string | number;

export type MatchProfileActions = {
  canLike: boolean;
  canPass: boolean;
  canHide: boolean;
  canBlock: boolean;
  canReport: boolean;
};

export type MatchProfileExplanationReason = {
  code: string;
  title: string;
  text: string;
  confidence: number;
};

export type MatchProfileExplanation = {
  profileId: MatchProfileId;
  candidateUserId: string;
  privacyLevel: string;
  reasons: MatchProfileExplanationReason[];
  disclaimer: string | null;
};

export type MatchProfileReactionAction = "like" | "pass" | "hide";

export type MatchProfileMatchLink = {
  matchId: string;
  conversationId: string;
};

export type MatchProfileReactionResult = "liked" | "passed" | "hidden" | "matched";

export type MatchProfileReaction = {
  result: MatchProfileReactionResult;
  match: MatchProfileMatchLink | null;
  nextCardHint: string | null;
};

export type MatchProfile = {
  id: MatchProfileId;
  candidateUserId: string | null;
  name: string;
  age: number | null;
  image: string | null;
  matchScore: number;
  tags: string[];
  explanation: string;
  location: string;
  activity: string;
  reasonCodes: string[];
  detailsAvailable: boolean;
  actions: MatchProfileActions | null;
  source: "feed";
};

export type MatchChatMessage = {
  id: number;
  text: string;
  sender: "me" | "them";
  time: string;
};

export type MatchmakingDraft = {
  photoUploaded: boolean;
  name: string;
  age: string;
};
