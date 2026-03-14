export type MatchProfile = {
  id: number;
  name: string;
  age: number;
  image: string;
  matchScore: number;
  tags: string[];
  explanation: string;
  location: string;
  activity: string;
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
