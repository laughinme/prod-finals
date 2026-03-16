import apiProtected from "./axiosInstance";
import type { FeedAction, FeedReactionResponseDto } from "./feed";

export type LikeNotificationPeerDto = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type LikeNotificationItemDto = {
  notification_id: string;
  liker_user_id: string;
  peer: LikeNotificationPeerDto;
  created_at: string;
  seen_at: string | null;
};

export type LikeNotificationsResponseDto = {
  items: LikeNotificationItemDto[];
  unseen_count: number;
};

export type LikeNotificationCardDto = {
  notification_id: string;
  candidate: {
    user_id: string;
    display_name: string;
    age: number | null;
    city: string | null;
    bio: string | null;
    avatar_url: string | null;
  };
  compatibility: {
    score: number;
    score_percent: number;
    preview: string;
    reason_codes: string[];
    category_breakdown: Array<{
      category_key: string;
      label: string;
      score_percent: number;
    }>;
  };
  actions: {
    can_like: boolean;
    can_pass: boolean;
    can_hide: boolean;
    can_block: boolean;
    can_report: boolean;
  };
};

export type LikeNotificationReactionRequestDto = {
  action: FeedAction;
  opened_explanation?: boolean;
  opened_profile?: boolean;
  dwell_time_ms?: number | null;
};

export type LikeNotificationReactionResponseDto = FeedReactionResponseDto & {
  notification_id: string;
};

export const getLikeNotifications = async (
  unseenOnly = false,
  limit = 20,
): Promise<LikeNotificationsResponseDto> => {
  const response = await apiProtected.get<LikeNotificationsResponseDto>(
    "/notifications/likes",
    {
      params: {
        unseen_only: unseenOnly,
        limit,
      },
    },
  );
  return response.data;
};

export const markLikeNotificationSeen = async (
  notificationId: string,
): Promise<{ notification_id: string; seen_at: string }> => {
  const response = await apiProtected.post(
    `/notifications/likes/${notificationId}/seen`,
  );
  return response.data;
};

export const getLikeNotificationCard = async (
  notificationId: string,
): Promise<LikeNotificationCardDto> => {
  const response = await apiProtected.get<LikeNotificationCardDto>(
    `/notifications/likes/${notificationId}/card`,
  );
  return response.data;
};

export const postLikeNotificationReaction = async (
  notificationId: string,
  payload: LikeNotificationReactionRequestDto,
): Promise<LikeNotificationReactionResponseDto> => {
  const response = await apiProtected.post<LikeNotificationReactionResponseDto>(
    `/notifications/likes/${notificationId}/reaction`,
    payload,
  );
  return response.data;
};
