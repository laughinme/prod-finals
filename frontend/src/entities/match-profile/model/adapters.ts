import type {
  CompatibilityExplanationResponseDto,
  FeedCardDto,
  FeedCardActionsDto,
  FeedReactionResponseDto,
} from "@/shared/api/feed";

import type {
  MatchProfileExplanation,
  MatchProfileExplanationReason,
  MatchProfileMatchLink,
  MatchProfileReaction,
  MatchProfile,
  MatchProfileActions,
} from "./types";

const toMatchProfileActions = (
  dto: FeedCardActionsDto,
): MatchProfileActions => ({
  canLike: dto.can_like,
  canPass: dto.can_pass,
  canHide: dto.can_hide,
  canBlock: dto.can_block,
  canReport: dto.can_report,
});

export const toMatchProfile = (dto: FeedCardDto): MatchProfile => ({
  id: dto.serve_item_id,
  candidateUserId: dto.candidate.user_id,
  name: dto.candidate.display_name,
  age: dto.candidate.age,
  image: dto.candidate.avatar_url,
  bio: dto.candidate.bio,
  matchScore: dto.compatibility.score_percent,
  categoryBreakdown: dto.compatibility.category_breakdown.map((cat) => ({
    categoryKey: cat.category_key,
    label: cat.label,
    scorePercent: cat.score_percent,
  })),
  tags: [],
  explanation: dto.compatibility.preview,
  location: dto.candidate.city ?? "",
  reasonCodes: dto.compatibility.reason_codes,
  detailsAvailable: dto.compatibility.details_available ?? true,
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

const toMatchProfileMatchLink = (
  dto: NonNullable<FeedReactionResponseDto["match"]>,
): MatchProfileMatchLink => ({
  matchId: dto.match_id,
  conversationId: dto.conversation_id,
});

export const toMatchProfileReaction = (
  dto: FeedReactionResponseDto,
): MatchProfileReaction => ({
  result: dto.result,
  match: dto.match ? toMatchProfileMatchLink(dto.match) : null,
  nextCardHint: dto.next_card_hint,
});
