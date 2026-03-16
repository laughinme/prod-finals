import type {
  BlockListResponseDto,
  BlockRequestDto,
  BlockResponseDto,
  ReportRequestDto,
  ReportResponseDto,
  UnblockResponseDto,
} from "@/shared/api/safety";

import type {
  BlockedUsersResult,
  BlockUserPayload,
  BlockUserResult,
  ReportUserPayload,
  ReportUserResult,
  UnblockUserResult,
} from "./types";

export const toBlockRequestDto = (
  payload: BlockUserPayload,
): BlockRequestDto => ({
  target_user_id: payload.targetUserId,
  source_context: payload.sourceContext,
  reason_code: payload.reasonCode,
});

export const toBlockUserResult = (
  dto: BlockResponseDto,
): BlockUserResult => ({
  status: dto.status,
  removedFromFutureFeed: dto.removed_from_future_feed,
  conversationClosed: dto.conversation_closed ?? null,
  matchClosed: dto.match_closed ?? null,
});

export const toBlockedUsersResult = (
  dto: BlockListResponseDto,
): BlockedUsersResult => ({
  items: dto.items.map((item) => ({
    blockId: item.block_id,
    targetUserId: item.target_user_id,
    displayName: item.display_name,
    avatarUrl: item.avatar_url ?? null,
    blockedAt: item.blocked_at,
    reasonCode: item.reason_code,
    sourceContext: item.source_context,
  })),
});

export const toUnblockUserResult = (
  dto: UnblockResponseDto,
): UnblockUserResult => ({
  status: dto.status,
  removedFromBlocklist: dto.removed_from_blocklist,
});

export const toReportRequestDto = (
  payload: ReportUserPayload,
): ReportRequestDto => ({
  target_user_id: payload.targetUserId,
  source_context: payload.sourceContext,
  category: payload.category,
  description: payload.description,
  related_message_id: payload.relatedMessageId,
  also_block: payload.alsoBlock,
});

export const toReportUserResult = (
  dto: ReportResponseDto,
): ReportUserResult => ({
  reportId: dto.report_id,
  status: dto.status,
  alsoBlockApplied: dto.also_block_applied,
});
