import { createContext } from "react";
import type { Centrifuge } from "centrifuge";

export type MatchNotification = {
  notificationId: string;
  matchId: string;
  conversationId: string;
  peer: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  seenAt: string | null;
};

export type MessageNotification = {
  notificationId: string;
  matchId: string;
  conversationId: string;
  messageId: string;
  sender: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
  };
  text: string;
  createdAt: string;
  seenAt: string | null;
  readAt: string | null;
};

export type MatchNotificationsContextValue = {
  currentNotification: MatchNotification | null;
  currentMessageNotification: MessageNotification | null;
  unseenMatchCount: number;
  unseenMatchIds: string[];
  unseenMessageCount: number;
  isRealtimeEnabled: boolean;
  realtimeClient: Centrifuge | null;
  dismissCurrentNotification: () => Promise<void>;
  dismissCurrentMessageNotification: () => Promise<void>;
  openCurrentMatch: () => Promise<void>;
  openCurrentMessageNotification: () => Promise<void>;
  markMatchAsSeen: (matchId: string) => Promise<void>;
  setActiveConversationId: (conversationId: string | null) => void;
  clearConversationMessageNotifications: (conversationId: string) => void;
};

export const MatchNotificationsContext = createContext<MatchNotificationsContextValue | null>(null);
