import apiProtected from "./axiosInstance";

export type MessageNotificationItemDto = {
  notification_id: string;
  match_id: string;
  conversation_id: string;
  message_id: string;
  peer: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  };
  preview_text: string;
  created_at: string;
  seen_at: string | null;
};

export type MessageNotificationsResponseDto = {
  items: MessageNotificationItemDto[];
  unseen_count: number;
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
): Promise<{ notification_id: string; seen_at: string }> => {
  const response = await apiProtected.post(
    `/notifications/messages/${notificationId}/seen`,
  );
  return response.data;
};
