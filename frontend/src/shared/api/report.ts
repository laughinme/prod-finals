import apiProtected from "./axiosInstance";

export type SafetySourceContext =
  | "feed"
  | "match_list"
  | "conversation"
  | "profile";

export type ReportCategory =
  | "harassment"
  | "spam"
  | "fake_profile"
  | "inappropriate_content"
  | "other";

export type ReportRequestDto = {
  target_user_id: string;
  source_context: SafetySourceContext;
  reason_code: ReportCategory;
};

export type ReportResponseDto = {
  status: string;
  removed_from_future_feed: boolean;
  conversation_closed: boolean | null;
  match_closed: boolean | null;
};

export const postReport = async (
  payload: ReportRequestDto,
): Promise<ReportResponseDto> => {
  const response = await apiProtected.post<ReportResponseDto>(
    "/reports",
    payload,
  );

  return response.data;
};
