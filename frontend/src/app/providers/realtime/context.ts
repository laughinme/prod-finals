import { createContext } from "react";

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

export type MatchNotificationsContextValue = {
  currentNotification: MatchNotification | null;
  unseenMatchCount: number;
  unseenMatchIds: string[];
  dismissCurrentNotification: () => Promise<void>;
  openCurrentMatch: () => Promise<void>;
  markMatchAsSeen: (matchId: string) => Promise<void>;
};

export const MatchNotificationsContext = createContext<MatchNotificationsContextValue | null>(null);
