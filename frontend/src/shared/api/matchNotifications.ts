import apiProtected from "./axiosInstance";

export type MatchNotificationPeerDto = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type MatchNotificationItemDto = {
  notification_id: string;
  match_id: string;
  conversation_id: string;
  peer: MatchNotificationPeerDto;
  created_at: string;
  seen_at: string | null;
};

export type MatchNotificationsResponseDto = {
  items: MatchNotificationItemDto[];
  unseen_count: number;
};

export type MarkNotificationSeenResponseDto = {
  notification_id: string;
  seen_at: string;
};

export const getMatchNotifications = async (
  unseenOnly = false,
  limit = 20,
): Promise<MatchNotificationsResponseDto> => {
  const response = await apiProtected.get<MatchNotificationsResponseDto>("/notifications/matches", {
    params: {
      unseen_only: unseenOnly,
      limit,
    },
  });
  return response.data;
};

export const markMatchNotificationSeen = async (
  notificationId: string,
): Promise<MarkNotificationSeenResponseDto> => {
  const response = await apiProtected.post<MarkNotificationSeenResponseDto>(
    `/notifications/matches/${notificationId}/seen`,
  );
  return response.data;
};
