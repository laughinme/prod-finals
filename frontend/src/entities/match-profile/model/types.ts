export type MatchProfileId = string | number;

export type MatchProfileReasonCode =
  | "city_fit"
  | "age_fit"
  | "goal_fit"
  | "mutual_preference_fit"
  | "lifestyle_overlap"
  | "behavioral_signal"
  | "profile_quality";

export type MatchProfileActions = {
  canLike: boolean;
  canPass: boolean;
  canHide: boolean;
  canBlock: boolean;
  canReport: boolean;
};

export type MatchProfile = {
  id: MatchProfileId;
  candidateUserId: string | null;
  name: string;
  age: number | null;
  image: string;
  matchScore: number;
  tags: string[];
  explanation: string;
  location: string;
  activity: string;
  reasonCodes: MatchProfileReasonCode[];
  detailsAvailable: boolean;
  actions: MatchProfileActions | null;
  source: "mock" | "feed";
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
  interests: string[];
};

export type CurrentUserPreview = {
  image: string;
};
