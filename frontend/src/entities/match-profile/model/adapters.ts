import type {
  CompatibilityExplanationResponseDto,
  FeedCardDto,
  FeedCardActionsDto,
} from "@/shared/api/feed";

import type {
  MatchProfileExplanation,
  MatchProfileExplanationReason,
  MatchProfile,
  MatchProfileActions,
  MatchProfileReasonCode,
} from "./types";

const DEFAULT_MATCH_PROFILE_IMAGE =
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop";

const MATCH_PROFILE_REASON_LABELS: Record<MatchProfileReasonCode, string> = {
  city_fit: "Один город",
  age_fit: "Возраст",
  goal_fit: "Цели",
  mutual_preference_fit: "Совпадение",
  lifestyle_overlap: "Образ жизни",
  behavioral_signal: "Ритм жизни",
  profile_quality: "Открытый профиль",
};

const toMatchProfileActions = (
  dto: FeedCardActionsDto,
): MatchProfileActions => ({
  canLike: dto.can_like,
  canPass: dto.can_pass,
  canHide: dto.can_hide,
  canBlock: dto.can_block,
  canReport: dto.can_report,
});

export const toMatchProfileReasonLabel = (
  code: MatchProfileReasonCode,
): string => MATCH_PROFILE_REASON_LABELS[code];

function isMatchProfileReasonCode(
  code: string,
): code is MatchProfileReasonCode {
  return code in MATCH_PROFILE_REASON_LABELS;
}

export const toMatchProfile = (dto: FeedCardDto): MatchProfile => ({
  id: dto.serve_item_id,
  candidateUserId: dto.candidate.user_id,
  name: dto.candidate.display_name,
  age: dto.candidate.age ?? null,
  image: dto.candidate.avatar_url ?? DEFAULT_MATCH_PROFILE_IMAGE,
  matchScore: Math.round(dto.compatibility.score * 100),
  tags: dto.compatibility.reason_codes
    .slice(0, 3)
    .map((code) => toMatchProfileReasonLabel(code as MatchProfileReasonCode)),
  explanation: dto.compatibility.preview,
  location: dto.candidate.city ?? "",
  activity: dto.candidate.profile_completion_badge ?? "",
  reasonCodes: dto.compatibility.reason_codes as MatchProfileReasonCode[],
  detailsAvailable: dto.compatibility.details_available,
  actions: toMatchProfileActions(dto.actions),
  source: "feed",
});

export const toMatchProfiles = (cards: FeedCardDto[]): MatchProfile[] =>
  cards.map(toMatchProfile);

const toMatchProfileExplanationReason = (
  reason: CompatibilityExplanationResponseDto["reasons"][number],
): MatchProfileExplanationReason => ({
  code: reason.code,
  title: reason.title,
  text: reason.text,
  confidence: reason.confidence,
  tag: isMatchProfileReasonCode(reason.code)
    ? toMatchProfileReasonLabel(reason.code)
    : null,
});

export const toMatchProfileExplanation = (
  dto: CompatibilityExplanationResponseDto,
): MatchProfileExplanation => ({
  profileId: dto.serve_item_id,
  candidateUserId: dto.candidate_user_id,
  privacyLevel: dto.privacy_level,
  reasons: dto.reasons.map(toMatchProfileExplanationReason),
  disclaimer: dto.disclaimer,
});
