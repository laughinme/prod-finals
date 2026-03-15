import apiProtected from "./axiosInstance";

export type RealtimeConnectionResponseDto = {
  enabled: boolean;
  ws_url: string | null;
  token: string | null;
  expires_at: string | null;
  channels: string[];
};

export const getRealtimeConnectionToken = async (): Promise<RealtimeConnectionResponseDto> => {
  const response = await apiProtected.get<RealtimeConnectionResponseDto>("/realtime/connection-token");
  return response.data;
};
