import apiProtected from "../axiosInstance";

export type ModerationReportStatusDto = "pending" | "resolved" | "dismissed";
export type ModerationReviewActionDto = "none" | "banned";

export type ModerationUserRefDto = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  banned: boolean;
};

export type ModerationReportItemDto = {
  id: string;
  created_at: string;
  source_context: "feed" | "match_list" | "conversation" | "profile";
  category: string;
  description: string | null;
  related_message_id: string | null;
  also_block: boolean;
  review_status: ModerationReportStatusDto;
  review_action: ModerationReviewActionDto;
  reviewed_at: string | null;
  review_note: string | null;
  actor: ModerationUserRefDto;
  target: ModerationUserRefDto;
  reviewer: ModerationUserRefDto | null;
};

export type ModerationReportSummaryDto = {
  total_reports: number;
  pending_reports: number;
  resolved_reports: number;
  dismissed_reports: number;
  banned_targets: number;
};

export type ModerationReportListResponseDto = {
  items: ModerationReportItemDto[];
};

export type ReviewModerationReportRequestDto = {
  status: Exclude<ModerationReportStatusDto, "pending">;
  review_note?: string | null;
  ban_user?: boolean;
};

export const getAdminModerationSummary =
  async (): Promise<ModerationReportSummaryDto> => {
    const response = await apiProtected.get<ModerationReportSummaryDto>(
      "/admins/moderation/reports/summary",
    );
    return response.data;
  };

export const getAdminModerationReports = async (
  status?: ModerationReportStatusDto | "all",
  limit = 50,
): Promise<ModerationReportListResponseDto> => {
  const response = await apiProtected.get<ModerationReportListResponseDto>(
    "/admins/moderation/reports/",
    {
      params: {
        status: status && status !== "all" ? status : undefined,
        limit,
      },
    },
  );
  return response.data;
};

export const reviewAdminReport = async (
  reportId: string,
  payload: ReviewModerationReportRequestDto,
) => {
  const response = await apiProtected.post<{ report: ModerationReportItemDto }>(
    `/admins/moderation/reports/${reportId}/review`,
    payload,
  );
  return response.data;
};
