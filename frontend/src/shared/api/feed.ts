import apiProtected from "./axiosInstance";

export type FeedState =
  | "locked"
  | "ready"
  | "degraded"
  | "exhausted";

export type ProfileStatus =
  | "draft"
  | "required_fields_missing"
  | "avatar_required"
  | "avatar_pending"
  | "ready"
  | "blocked";

export type QuizStatus =
  | "not_started"
  | "in_progress"
  | "skipped"
  | "completed";

export type RecommendationMode =
  | "cold_start"
  | "behavioral"
  | "hybrid";

export type DecisionMode =
  | "model"
  | "fallback";

export type FeedLockReason =
  | "avatar_required"
  | "avatar_pending"
  | "required_fields_missing"
  | "blocked";

export type NextActionType =
  | "upload_avatar"
  | "complete_required_fields"
  | "start_quiz"
  | "resume_quiz"
  | "open_feed"
  | "wait_for_moderation";

export type FeedEmptyStateCode =
  | "no_more_candidates_today"
  | "candidate_pool_low"
  | "safety_filtered_all"
  | "try_again_tomorrow";

export type FeedNextActionDto = {
  type: NextActionType;
  title: string;
  description: string | null;
  cta_label: string | null;
};

export type FeedCandidateDto = {
  user_id: string;
  display_name: string;
  age: number | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  profile_completion_badge: string | null;
};

export type FeedCompatibilityDto = {
  score: number;
  preview: string;
  reason_codes: string[];
  details_available: boolean;
};

export type FeedCardActionsDto = {
  can_like: boolean;
  can_pass: boolean;
  can_hide: boolean;
  can_block: boolean;
  can_report: boolean;
};

export type FeedCardDto = {
  serve_item_id: string;
  candidate: FeedCandidateDto;
  compatibility: FeedCompatibilityDto;
  actions: FeedCardActionsDto;
};

export type CompatibilityReasonDto = {
  code: string;
  title: string;
  text: string;
  confidence: number;
};

export type CompatibilityExplanationResponseDto = {
  serve_item_id: string;
  candidate_user_id: string;
  privacy_level: string;
  reasons: CompatibilityReasonDto[];
  disclaimer: string | null;
};

export type FeedEmptyStateDto = {
  code: FeedEmptyStateCode;
  title: string;
  description: string | null;
};

export type FeedResponseDto = {
  feed_state: FeedState;
  profile_status: ProfileStatus;
  quiz_status: QuizStatus;
  recommendation_mode: RecommendationMode;
  decision_mode: DecisionMode;
  batch_id: string | null;
  generated_at: string | null;
  expires_at: string | null;
  lock_reason: FeedLockReason | null;
  next_action: FeedNextActionDto | null;
  cards: FeedCardDto[];
  empty_state: FeedEmptyStateDto | null;
  warnings: string[];
};

export const getFeed = async (limit = 20): Promise<FeedResponseDto> => {
  const response = await apiProtected.get<FeedResponseDto>("/feed", {
    params: { limit },
  });

  return response.data;
};

export const getFeedItemExplanation = async (
  serveItemId: string,
): Promise<CompatibilityExplanationResponseDto> => {
  const response = await apiProtected.get<CompatibilityExplanationResponseDto>(
    `/feed/items/${serveItemId}/explanation`,
  );

  return response.data;
};
