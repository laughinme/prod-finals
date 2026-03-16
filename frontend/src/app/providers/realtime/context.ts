import { createContext } from "react";
import type { Centrifuge } from "centrifuge";

export type NotificationPeer = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type PersonalNotification =
  | {
      kind: "match";
      notificationId: string;
      matchId: string;
      conversationId: string;
      peer: NotificationPeer;
      createdAt: string;
      seenAt: string | null;
    }
  | {
      kind: "like";
      notificationId: string;
      likerUserId: string;
      peer: NotificationPeer;
      createdAt: string;
      seenAt: string | null;
    }
  | {
      kind: "message";
      notificationId: string;
      matchId: string;
      conversationId: string;
      messageId: string;
      peer: NotificationPeer;
      previewText: string;
      createdAt: string;
      seenAt: string | null;
    };

export type MatchNotificationsContextValue = {
  currentNotification: PersonalNotification | null;
  unseenMatchCount: number;
  unseenLikeCount: number;
  isRealtimeEnabled: boolean;
  realtimeClient: Centrifuge | null;
  dismissCurrentNotification: () => Promise<void>;
  openCurrentNotification: () => Promise<void>;
  markMatchAsSeen: (matchId: string) => Promise<void>;
};

export const MatchNotificationsContext =
  createContext<MatchNotificationsContextValue | null>(null);
