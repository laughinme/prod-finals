import type {
  CloseMatchResponseDto,
  MatchListItemDto,
} from "@/shared/api/matches";

import type { ClosedMatchResult, MatchListItem } from "./types";

export const toMatchListItem = (dto: MatchListItemDto): MatchListItem => ({
  matchId: dto.match_id,
  candidateUserId: dto.candidate_user_id,
  displayName: dto.display_name,
  avatarUrl: dto.avatar_url,
  conversationId: dto.conversation_id,
  status: dto.status,
  lastMessagePreview: dto.last_message_preview,
  lastMessageAt: dto.last_message_at,
  unreadCount: dto.unread_count,
});

export const toMatchListItems = (items: MatchListItemDto[]): MatchListItem[] =>
  items.map(toMatchListItem);

export const toClosedMatchResult = (
  dto: CloseMatchResponseDto,
): ClosedMatchResult => ({
  status: dto.status,
  removedFromFutureFeed: dto.removed_from_future_feed,
});
