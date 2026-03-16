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
import * as Sentry from "@sentry/react";

import { useAuth } from "@/entities/auth";
import { MATCHES_QUERY_KEY } from "@/features/match/model/useMatches";
import { getLikeNotifications, markLikeNotificationSeen, type LikeNotificationItemDto } from "@/shared/api/likeNotifications";
import { getMatchNotifications, markMatchNotificationSeen, type MatchNotificationItemDto } from "@/shared/api/matchNotifications";
import { getMessageNotifications, markMessageNotificationSeen, type MessageNotificationItemDto } from "@/shared/api/messageNotifications";
import { getRealtimeConnectionToken } from "@/shared/api/realtime";
import { MatchNotificationModal } from "./MatchNotificationModal";
import { MatchNotificationsContext, type PersonalNotification } from "./context";

type RealtimeProviderProps = {
  children: ReactNode;
};

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

type LikeReceivedRealtimePayload = {
  notification_id: string;
  liker_user_id: string;
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
  peer: {
    user_id: string;
    display_name: string;
    avatar_url: string | null;
  };
  preview_text: string;
  created_at: string;
};

const toMatchNotification = (
  dto: MatchNotificationItemDto,
): PersonalNotification => ({
  kind: "match",
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

const toLikeNotification = (
  dto: LikeNotificationItemDto,
): PersonalNotification => ({
  kind: "like",
  notificationId: dto.notification_id,
  likerUserId: dto.liker_user_id,
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
): PersonalNotification => ({
  kind: "message",
  notificationId: dto.notification_id,
  matchId: dto.match_id,
  conversationId: dto.conversation_id,
  messageId: dto.message_id,
  peer: {
    userId: dto.peer.user_id,
    displayName: dto.peer.display_name,
    avatarUrl: dto.peer.avatar_url,
  },
  previewText: dto.preview_text,
  createdAt: dto.created_at,
  seenAt: dto.seen_at,
});

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientRef = useRef<Centrifuge | null>(null);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  const [notifications, setNotifications] = useState<PersonalNotification[]>([]);

  const mergeNotifications = useCallback((items: PersonalNotification[]) => {
    setNotifications((prev) => {
      const next = new Map<string, PersonalNotification>();
      for (const notification of [...items, ...prev]) {
        next.set(notification.notificationId, notification);
      }
      return [...next.values()].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    });
  }, []);

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.notificationId !== notificationId),
    );
  }, []);

  const markSeenByNotification = useCallback(
    async (notification: PersonalNotification) => {
      if (notification.seenAt) {
        removeNotification(notification.notificationId);
        return;
      }

      if (notification.kind === "match") {
        await markMatchNotificationSeen(notification.notificationId);
      } else if (notification.kind === "like") {
        await markLikeNotificationSeen(notification.notificationId);
      } else {
        await markMessageNotificationSeen(notification.notificationId);
      }

      removeNotification(notification.notificationId);
    },
    [removeNotification],
  );

  const markMatchAsSeen = useCallback(
    async (matchId: string) => {
      const notification = notifications.find(
        (item) => item.kind === "match" && item.matchId === matchId,
      );
      if (!notification) {
        return;
      }
      await markSeenByNotification(notification);
    },
    [markSeenByNotification, notifications],
  );

  const currentNotification = notifications[0] ?? null;
  const unseenMatchCount = notifications.filter(
    (item) => item.kind === "match" && !item.seenAt,
  ).length;
  const unseenLikeCount = notifications.filter(
    (item) => item.kind === "like" && !item.seenAt,
  ).length;

  const dismissCurrentNotification = useCallback(async () => {
    if (!currentNotification) {
      return;
    }
    await markSeenByNotification(currentNotification);
    await queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
  }, [currentNotification, markSeenByNotification, queryClient]);

  const openCurrentNotification = useCallback(async () => {
    if (!currentNotification) {
      return;
    }

    await markSeenByNotification(currentNotification);
    void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });

    if (currentNotification.kind === "match") {
      navigate("/match", {
        state: {
          matchedProfile: {
            id: currentNotification.peer.userId,
            candidateUserId: currentNotification.peer.userId,
            name: currentNotification.peer.displayName,
            age: null,
            image: currentNotification.peer.avatarUrl,
            bio: "",
            matchScore: 0,
            categoryBreakdown: [],
            tags: [],
            explanation: "",
            location: "",
            reasonCodes: [],
            detailsAvailable: false,
            actions: null,
            source: "feed",
          },
          matchId: currentNotification.matchId,
          conversationId: currentNotification.conversationId,
        },
      });
      return;
    }

    if (currentNotification.kind === "message") {
      navigate(`/chat?match=${currentNotification.matchId}`, {
        state: {
          matchId: currentNotification.matchId,
          conversationId: currentNotification.conversationId,
        },
      });
      return;
    }

    navigate("/discovery", {
      state: {
        likeNotificationId: currentNotification.notificationId,
      },
    });
  }, [currentNotification, markSeenByNotification, navigate, queryClient]);

  useEffect(() => {
    if (!auth?.user) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      setIsRealtimeEnabled(false);
      setNotifications([]);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [matches, likes, messages] = await Promise.all([
          getMatchNotifications(true, 20),
          getLikeNotifications(true, 20),
          getMessageNotifications(true, 20),
        ]);
        if (!cancelled) {
          mergeNotifications([
            ...matches.items.map(toMatchNotification),
            ...likes.items.map(toLikeNotification),
            ...messages.items.map(toMessageNotification),
          ]);
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
            payload?:
              | MatchCreatedRealtimePayload
              | LikeReceivedRealtimePayload
              | MessageReceivedRealtimePayload;
          };
          if (!event.type || !event.payload) {
            return;
          }

          if (event.type === "match_created") {
            const payload = event.payload as MatchCreatedRealtimePayload;
            mergeNotifications([
              {
                kind: "match",
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

          if (event.type === "like_received") {
            const payload = event.payload as LikeReceivedRealtimePayload;
            mergeNotifications([
              {
                kind: "like",
                notificationId: payload.notification_id,
                likerUserId: payload.liker_user_id,
                peer: {
                  userId: payload.peer.user_id,
                  displayName: payload.peer.display_name,
                  avatarUrl: payload.peer.avatar_url,
                },
                createdAt: payload.created_at,
                seenAt: null,
              },
            ]);
            return;
          }

          if (event.type === "message_received") {
            const payload = event.payload as MessageReceivedRealtimePayload;
            mergeNotifications([
              {
                kind: "message",
                notificationId: payload.notification_id,
                matchId: payload.match_id,
                conversationId: payload.conversation_id,
                messageId: payload.message_id,
                peer: {
                  userId: payload.peer.user_id,
                  displayName: payload.peer.display_name,
                  avatarUrl: payload.peer.avatar_url,
                },
                previewText: payload.preview_text,
                createdAt: payload.created_at,
                seenAt: null,
              },
            ]);
            void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
          }
        });

        client.connect();
        clientRef.current = client;
        setIsRealtimeEnabled(true);
      } catch (e) {
        Sentry.captureException(e);
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
  }, [auth?.user, mergeNotifications, queryClient]);

  const value = useMemo(
    () => ({
      currentNotification,
      unseenMatchCount,
      unseenLikeCount,
      isRealtimeEnabled,
      realtimeClient: clientRef.current,
      dismissCurrentNotification,
      openCurrentNotification,
      markMatchAsSeen,
    }),
    [
      currentNotification,
      dismissCurrentNotification,
      isRealtimeEnabled,
      markMatchAsSeen,
      openCurrentNotification,
      unseenLikeCount,
      unseenMatchCount,
    ],
  );

  return (
    <MatchNotificationsContext.Provider value={value}>
      {children}
      <MatchNotificationModal
        notification={currentNotification}
        onLater={() => void dismissCurrentNotification()}
        onOpen={() => void openCurrentNotification()}
      />
    </MatchNotificationsContext.Provider>
  );
}
