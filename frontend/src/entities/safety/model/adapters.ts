import type {
  BlockRequestDto,
  BlockResponseDto,
  ReportRequestDto,
  ReportResponseDto,
} from "@/shared/api/safety";

import type {
  BlockUserPayload,
  BlockUserResult,
  ReportUserPayload,
  ReportUserResult,
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
