import apiProtected from "./axiosInstance";
import {
  toBlockRequestDto,
  toBlockUserResult,
  toReportRequestDto,
  toReportUserResult,
  type BlockReasonCode,
  type BlockUserPayload,
  type BlockUserResult,
  type ReportCategory,
  type ReportUserPayload,
  type ReportUserResult,
  type SafetySourceContext,
} from "@/entities/safety";

export type SafetySourceContextDto = SafetySourceContext;
export type BlockReasonCodeDto = BlockReasonCode;
export type ReportCategoryDto = ReportCategory;

export type BlockRequestDto = {
  target_user_id: string;
  source_context: SafetySourceContextDto;
  reason_code: BlockReasonCodeDto;
};

export type BlockResponseDto = {
  status: "blocked";
  removed_from_future_feed: boolean;
  conversation_closed: boolean | null;
  match_closed: boolean | null;
};

export type ReportRequestDto = {
  target_user_id: string;
  source_context: SafetySourceContextDto;
  category: ReportCategoryDto;
  description?: string | null;
  related_message_id?: string | null;
  also_block?: boolean;
};

export type ReportResponseDto = {
  report_id: string;
  status: "accepted";
  also_block_applied: boolean;
};

export const postBlock = async (
  payload: BlockUserPayload,
): Promise<BlockUserResult> => {
  const response = await apiProtected.post<BlockResponseDto>(
    "/blocks",
    toBlockRequestDto(payload),
  );

  return toBlockUserResult(response.data);
};

export const postReport = async (
  payload: ReportUserPayload,
): Promise<ReportUserResult> => {
  const response = await apiProtected.post<ReportResponseDto>(
    "/reports",
    toReportRequestDto(payload),
  );

  return toReportUserResult(response.data);
};
