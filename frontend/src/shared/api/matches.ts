import apiProtected from "./axiosInstance";

export type MatchStatus = "active" | "closed" | "blocked";

export type MatchListItemDto = {
  match_id: string;
  candidate_user_id: string;
  display_name: string;
  avatar_url: string | null;
  conversation_id: string | null;
  status: MatchStatus;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type MatchListResponseDto = {
  items: MatchListItemDto[];
};

export type CloseMatchReasonCode =
  | "not_interested"
  | "conversation_finished"
  | "other";

export type CloseMatchRequestDto = {
  reason_code: CloseMatchReasonCode;
};

export type CloseMatchResponseDto = {
  status: string;
  removed_from_future_feed: boolean;
};

export const getMatches = async (): Promise<MatchListResponseDto> => {
  const response = await apiProtected.get<MatchListResponseDto>("/matches");

  return response.data;
};

export const postCloseMatch = async (
  matchId: string,
  payload: CloseMatchRequestDto,
): Promise<CloseMatchResponseDto> => {
  const response = await apiProtected.post<CloseMatchResponseDto>(
    `/matches/${matchId}/close`,
    payload,
  );

  return response.data;
};
