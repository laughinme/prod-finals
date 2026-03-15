import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Centrifuge, UnauthorizedError } from "centrifuge";

import { useAuth } from "@/app/providers/auth/useAuth";
import { MessageNotificationToast } from "./MessageNotificationToast";
import { MatchNotificationModal } from "./MatchNotificationModal";
import {
  MatchNotificationsContext,
  type MatchNotification,
  type MessageNotification,
} from "./context";
import {
  getMessageNotifications,
  markMessageNotificationSeen,
  type MessageNotificationItemDto,
} from "@/shared/api/messageNotifications";
import {
  getMatchNotifications,
  markMatchNotificationSeen,
  type MatchNotificationItemDto,
} from "@/shared/api/matchNotifications";
import { getRealtimeConnectionToken } from "@/shared/api/realtime";
import { MATCHES_QUERY_KEY } from "@/features/match/model/useMatches";
import * as Sentry from "@sentry/react";

type RealtimeProviderProps = {
  children: ReactNode;
};

const toMatchNotification = (
  dto: MatchNotificationItemDto,
): MatchNotification => ({
  notificationId: dto.notification_id,
  matchId: dto.match_id,
  conversationId: dto.conversation_id,
  peer: {
    userId: dto.peer.user_id,
    displayName: dto.peer.display_name,
    avatarUrl: dto.peer.avatar_url,
  },
  createdAt: dto.created_at,
  seenAt: dto.seen_at,
});

const toMessageNotification = (
  dto: MessageNotificationItemDto,
): MessageNotification => ({
  notificationId: dto.notification_id,
  matchId: dto.match_id,
  conversationId: dto.conversation_id,
  messageId: dto.message_id,
  sender: {
    userId: dto.sender.user_id,
    displayName: dto.sender.display_name,
    avatarUrl: dto.sender.avatar_url,
  },
  text: dto.text,
  createdAt: dto.created_at,
  seenAt: dto.seen_at,
  readAt: dto.read_at,
});

type MatchCreatedRealtimePayload = {
  notification_id: string;
  match_id: string;
  conversation_id: string;
  peer: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  };
  created_at: string;
};

type MessageReceivedRealtimePayload = {
  notification_id: string;
  match_id: string;
  conversation_id: string;
  message_id: string;
  sender: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  };
  text: string;
  created_at: string;
};

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientRef = useRef<Centrifuge | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  const [matchNotifications, setMatchNotifications] = useState<MatchNotification[]>([]);
  const [messageNotifications, setMessageNotifications] = useState<MessageNotification[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const mergeMatchNotifications = useCallback((items: MatchNotification[]) => {
    setMatchNotifications((prev) => {
      const next = new Map<string, MatchNotification>();
      for (const notification of [...items, ...prev]) {
        next.set(notification.notificationId, notification);
      }
      return [...next.values()].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    });
  }, []);

  const mergeMessageNotifications = useCallback((items: MessageNotification[]) => {
    setMessageNotifications((prev) => {
      const next = new Map<string, MessageNotification>();
      for (const notification of [...items, ...prev]) {
        next.set(notification.notificationId, notification);
      }
      return [...next.values()].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    });
  }, []);

  const removeMatchNotification = useCallback((notificationId: string) => {
    setMatchNotifications((prev) =>
      prev.filter((notification) => notification.notificationId !== notificationId),
    );
  }, []);

  const removeMessageNotification = useCallback((notificationId: string) => {
    setMessageNotifications((prev) =>
      prev.filter((notification) => notification.notificationId !== notificationId),
    );
  }, []);

  const clearConversationMessageNotifications = useCallback((conversationId: string) => {
    setMessageNotifications((prev) =>
      prev.filter((notification) => notification.conversationId !== conversationId),
    );
  }, []);

  const markMatchSeenByNotificationId = useCallback(
    async (notificationId: string) => {
      const existing = matchNotifications.find(
        (notification) => notification.notificationId === notificationId,
      );
      if (!existing || existing.seenAt) {
        removeMatchNotification(notificationId);
        return;
      }
      await markMatchNotificationSeen(notificationId);
      removeMatchNotification(notificationId);
    },
    [matchNotifications, removeMatchNotification],
  );

  const markMatchAsSeen = useCallback(
    async (matchId: string) => {
      const notification = matchNotifications.find((item) => item.matchId === matchId);
      if (!notification) {
        return;
      }
      await markMatchSeenByNotificationId(notification.notificationId);
    },
    [markMatchSeenByNotificationId, matchNotifications],
  );

  const markMessageSeenByNotificationId = useCallback(
    async (notificationId: string) => {
      const existing = messageNotifications.find(
        (notification) => notification.notificationId === notificationId,
      );
      if (!existing || existing.seenAt) {
        removeMessageNotification(notificationId);
        return;
      }
      await markMessageNotificationSeen(notificationId);
      removeMessageNotification(notificationId);
    },
    [messageNotifications, removeMessageNotification],
  );

  const currentNotification = matchNotifications[0] ?? null;
  const currentMessageNotification = messageNotifications[0] ?? null;
  const unseenMatchIds = useMemo(
    () => matchNotifications.filter((item) => !item.seenAt).map((item) => item.matchId),
    [matchNotifications],
  );
  const unseenMessageCount = useMemo(
    () => messageNotifications.filter((item) => !item.seenAt).length,
    [messageNotifications],
  );
  const unseenMatchCount = unseenMatchIds.length;

  const dismissCurrentNotification = useCallback(async () => {
    if (!currentNotification) {
      return;
    }
    await markMatchSeenByNotificationId(currentNotification.notificationId);
  }, [currentNotification, markMatchSeenByNotificationId]);

  const openCurrentMatch = useCallback(async () => {
    if (!currentNotification) {
      return;
    }
    await markMatchSeenByNotificationId(currentNotification.notificationId);
    await queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    navigate("/chat", {
      state: {
        matchId: currentNotification.matchId,
        conversationId: currentNotification.conversationId,
      },
    });
  }, [currentNotification, markMatchSeenByNotificationId, navigate, queryClient]);

  const dismissCurrentMessageNotification = useCallback(async () => {
    if (!currentMessageNotification) {
      return;
    }
    await markMessageSeenByNotificationId(currentMessageNotification.notificationId);
  }, [currentMessageNotification, markMessageSeenByNotificationId]);

  const openCurrentMessageNotification = useCallback(async () => {
    if (!currentMessageNotification) {
      return;
    }
    await markMessageSeenByNotificationId(currentMessageNotification.notificationId);
    await queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    navigate("/chat", {
      state: {
        matchId: currentMessageNotification.matchId,
        conversationId: currentMessageNotification.conversationId,
      },
    });
  }, [currentMessageNotification, markMessageSeenByNotificationId, navigate, queryClient]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!auth?.user) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      setIsRealtimeEnabled(false);
      setMatchNotifications([]);
      setMessageNotifications([]);
      setActiveConversationId(null);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [initialMatches, initialMessages] = await Promise.all([
          getMatchNotifications(true, 20),
          getMessageNotifications(true, 20),
        ]);
        if (!cancelled) {
          mergeMatchNotifications(initialMatches.items.map(toMatchNotification));
          mergeMessageNotifications(initialMessages.items.map(toMessageNotification));
        }
      } catch (e) {
        Sentry.captureException(e);
      }

      try {
        const connection = await getRealtimeConnectionToken();
        if (
          cancelled ||
          !connection.enabled ||
          !connection.ws_url ||
          !connection.token
        ) {
          setIsRealtimeEnabled(false);
          return;
        }

        const client = new Centrifuge(connection.ws_url, {
          token: connection.token,
          getToken: async () => {
            const refreshed = await getRealtimeConnectionToken();
            if (!refreshed.enabled || !refreshed.token) {
              throw new UnauthorizedError("unauthorized error");
            }
            return refreshed.token;
          },
        });

        client.on("publication", (ctx) => {
          if (!String(ctx.channel).startsWith("personal-")) {
            return;
          }
          const event = ctx.data as {
            type?: string;
            payload?: MatchCreatedRealtimePayload | MessageReceivedRealtimePayload;
          };
          if (!event.type || !event.payload) {
            return;
          }
          if (event.type === "match_created") {
            const payload = event.payload as MatchCreatedRealtimePayload;
            mergeMatchNotifications([
              {
                notificationId: payload.notification_id,
                matchId: payload.match_id,
                conversationId: payload.conversation_id,
                peer: {
                  userId: payload.peer.user_id,
                  displayName: payload.peer.display_name,
                  avatarUrl: payload.peer.avatar_url,
                },
                createdAt: payload.created_at,
                seenAt: null,
              },
            ]);
            void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
            return;
          }

          if (event.type === "message_received") {
            const payload = event.payload as MessageReceivedRealtimePayload;
            void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
            if (activeConversationIdRef.current === payload.conversation_id) {
              return;
            }
            mergeMessageNotifications([
              {
                notificationId: payload.notification_id,
                matchId: payload.match_id,
                conversationId: payload.conversation_id,
                messageId: payload.message_id,
                sender: {
                  userId: payload.sender.user_id,
                  displayName: payload.sender.display_name,
                  avatarUrl: payload.sender.avatar_url,
                },
                text: payload.text,
                createdAt: payload.created_at,
                seenAt: null,
                readAt: null,
              },
            ]);
          }
        });

        client.connect();
        clientRef.current = client;
        setIsRealtimeEnabled(true);
      } catch {
        setIsRealtimeEnabled(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      clientRef.current?.disconnect();
      clientRef.current = null;
      setIsRealtimeEnabled(false);
    };
  }, [
    auth?.user,
    mergeMatchNotifications,
    mergeMessageNotifications,
    queryClient,
  ]);

  const value = useMemo(
    () => ({
      currentNotification,
      currentMessageNotification,
      isRealtimeEnabled,
      realtimeClient: clientRef.current,
      unseenMatchCount,
      unseenMatchIds,
      unseenMessageCount,
      dismissCurrentNotification,
      dismissCurrentMessageNotification,
      openCurrentMatch,
      openCurrentMessageNotification,
      markMatchAsSeen,
      setActiveConversationId,
      clearConversationMessageNotifications,
    }),
    [
      clearConversationMessageNotifications,
      currentNotification,
      currentMessageNotification,
      dismissCurrentNotification,
      dismissCurrentMessageNotification,
      isRealtimeEnabled,
      markMatchAsSeen,
      openCurrentMatch,
      openCurrentMessageNotification,
      setActiveConversationId,
      unseenMatchCount,
      unseenMatchIds,
      unseenMessageCount,
    ],
  );

  return (
    <MatchNotificationsContext.Provider value={value}>
      {children}
      <MatchNotificationModal
        notification={currentNotification}
        onLater={() => void dismissCurrentNotification()}
        onWrite={() => void openCurrentMatch()}
      />
      <MessageNotificationToast
        notification={currentMessageNotification}
        onDismiss={() => void dismissCurrentMessageNotification()}
        onOpen={() => void openCurrentMessageNotification()}
      />
    </MatchNotificationsContext.Provider>
  );
}
