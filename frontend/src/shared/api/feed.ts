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
};

export type FeedCompatibilityDto = {
  score: number;
  score_percent: number;
  preview: string;
  reason_codes: string[];
  category_breakdown: Array<{
    category_key: string;
    label: string;
    score_percent: number;
  }>;
  details_available?: boolean;
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
  liked_you: boolean;
};

export type DemoFeedShortcutItemDto = {
  demo_user_key: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  is_current_user: boolean;
};

export type DemoFeedShortcutListResponseDto = {
  items: DemoFeedShortcutItemDto[];
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

export type FeedAction = "like" | "pass" | "hide";

export type FeedReactionRequestDto = {
  action: FeedAction;
  opened_explanation?: boolean;
  opened_profile?: boolean;
  dwell_time_ms?: number | null;
};

export type MatchLinkDto = {
  match_id: string;
  conversation_id: string;
};

export type FeedReactionResult = "liked" | "passed" | "hidden" | "matched";

export type FeedReactionResponseDto = {
  result: FeedReactionResult;
  match: MatchLinkDto | null;
  next_card_hint: string | null;
};

export type FeedTestMatchResponseDto = {
  status: string;
  message: string;
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

export const getDemoFeedShortcuts = async (): Promise<DemoFeedShortcutListResponseDto> => {
  const response = await apiProtected.get<DemoFeedShortcutListResponseDto>(
    "/feed/demo-shortcuts",
  );
  return response.data;
};

export const getDemoFeedCard = async (demoUserKey: string): Promise<FeedCardDto> => {
  const response = await apiProtected.get<FeedCardDto>(
    `/feed/demo-shortcuts/${demoUserKey}/card`,
  );
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

export const postFeedReaction = async (
  serveItemId: string,
  payload: FeedReactionRequestDto,
): Promise<FeedReactionResponseDto> => {
  const response = await apiProtected.post<FeedReactionResponseDto>(
    `/feed/items/${serveItemId}/reaction`,
    payload,
  );

  return response.data;
};

export const postFeedTestMatch = async (
  serveItemId: string,
): Promise<FeedTestMatchResponseDto> => {
  const response = await apiProtected.post<FeedTestMatchResponseDto>(
    `/feed/items/${serveItemId}/test-match`,
  );

  return response.data;
};
