import apiProtected from "./axiosInstance";

export type MessageNotificationPeerDto = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type MessageNotificationItemDto = {
  notification_id: string;
  match_id: string;
  conversation_id: string;
  message_id: string;
  sender: MessageNotificationPeerDto;
  text: string;
  created_at: string;
  seen_at: string | null;
  read_at: string | null;
};

export type MessageNotificationsResponseDto = {
  items: MessageNotificationItemDto[];
  unseen_count: number;
};

export type MarkMessageNotificationSeenResponseDto = {
  notification_id: string;
  seen_at: string;
};

export const getMessageNotifications = async (
  unseenOnly = false,
  limit = 20,
): Promise<MessageNotificationsResponseDto> => {
  const response = await apiProtected.get<MessageNotificationsResponseDto>(
    "/notifications/messages",
    {
      params: {
        unseen_only: unseenOnly,
        limit,
      },
    },
  );
  return response.data;
};

export const markMessageNotificationSeen = async (
  notificationId: string,
): Promise<MarkMessageNotificationSeenResponseDto> => {
  const response = await apiProtected.post<MarkMessageNotificationSeenResponseDto>(
    `/notifications/messages/${notificationId}/seen`,
  );
  return response.data;
};
