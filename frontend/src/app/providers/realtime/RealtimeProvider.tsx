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
import { MatchNotificationModal } from "./MatchNotificationModal";
import { MatchNotificationsContext, type MatchNotification } from "./context";
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

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientRef = useRef<Centrifuge | null>(null);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  const [notifications, setNotifications] = useState<MatchNotification[]>([]);

  const mergeNotifications = useCallback((items: MatchNotification[]) => {
    setNotifications((prev) => {
      const next = new Map<string, MatchNotification>();
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
      prev.filter(
        (notification) => notification.notificationId !== notificationId,
      ),
    );
  }, []);

  const markSeenByNotificationId = useCallback(
    async (notificationId: string) => {
      const existing = notifications.find(
        (notification) => notification.notificationId === notificationId,
      );
      if (!existing || existing.seenAt) {
        removeNotification(notificationId);
        return;
      }
      await markMatchNotificationSeen(notificationId);
      removeNotification(notificationId);
    },
    [notifications, removeNotification],
  );

  const markMatchAsSeen = useCallback(
    async (matchId: string) => {
      const notification = notifications.find(
        (item) => item.matchId === matchId,
      );
      if (!notification) {
        return;
      }
      await markSeenByNotificationId(notification.notificationId);
    },
    [markSeenByNotificationId, notifications],
  );

  const currentNotification = notifications[0] ?? null;
  const unseenMatchIds = useMemo(
    () =>
      notifications.filter((item) => !item.seenAt).map((item) => item.matchId),
    [notifications],
  );
  const unseenMatchCount = unseenMatchIds.length;

  const dismissCurrentNotification = useCallback(async () => {
    if (!currentNotification) {
      return;
    }
    await markSeenByNotificationId(currentNotification.notificationId);
  }, [currentNotification, markSeenByNotificationId]);

  const openCurrentMatch = useCallback(async () => {
    if (!currentNotification) {
      return;
    }
    await markSeenByNotificationId(currentNotification.notificationId);
    await queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    navigate("/chat", {
      state: {
        matchId: currentNotification.matchId,
        conversationId: currentNotification.conversationId,
      },
    });
  }, [currentNotification, markSeenByNotificationId, navigate, queryClient]);

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
        const initial = await getMatchNotifications(true, 20);
        if (!cancelled) {
          mergeNotifications(initial.items.map(toMatchNotification));
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
            payload?: MatchCreatedRealtimePayload;
          };
          if (event.type !== "match_created" || !event.payload) {
            return;
          }

          mergeNotifications([
            {
              notificationId: event.payload.notification_id,
              matchId: event.payload.match_id,
              conversationId: event.payload.conversation_id,
              peer: {
                userId: event.payload.peer.user_id,
                displayName: event.payload.peer.display_name,
                avatarUrl: event.payload.peer.avatar_url,
              },
              createdAt: event.payload.created_at,
              seenAt: null,
            },
          ]);
          void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
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
  }, [auth?.user, mergeNotifications, queryClient]);

  const value = useMemo(
    () => ({
      currentNotification,
      isRealtimeEnabled,
      realtimeClient: clientRef.current,
      unseenMatchCount,
      unseenMatchIds,
      dismissCurrentNotification,
      openCurrentMatch,
      markMatchAsSeen,
    }),
    [
      currentNotification,
      dismissCurrentNotification,
      isRealtimeEnabled,
      markMatchAsSeen,
      openCurrentMatch,
      unseenMatchCount,
      unseenMatchIds,
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
    </MatchNotificationsContext.Provider>
  );
}
