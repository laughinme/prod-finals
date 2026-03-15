import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UnauthorizedError, type Subscription } from "centrifuge";
import * as Sentry from "@sentry/react";

import { useMatchNotifications } from "@/app/providers/realtime/useMatchNotifications";
import {
  conversationsApi,
  type ConversationMessagesResponse,
} from "@/shared/api/conversations";
import { MATCHES_QUERY_KEY } from "@/features/match/model/useMatches";

import {
  appendMessage,
  buildConversationMessagesQueryKey,
  buildConversationQueryKey,
} from "./conversationCache";
import type { RealtimeChatEvent } from "./types";

export function useConversationRealtime(activeConversationId: string | null) {
  const queryClient = useQueryClient();
  const matchNotifications = useMatchNotifications();

  useEffect(() => {
    if (
      !activeConversationId ||
      !matchNotifications?.isRealtimeEnabled ||
      !matchNotifications.realtimeClient
    ) {
      return;
    }

    let cancelled = false;
    let subscription: Subscription | null = null;

    const subscribeToConversation = async () => {
      try {
        const realtime =
          await conversationsApi.getRealtimeToken(activeConversationId);
        if (
          cancelled ||
          !realtime.enabled ||
          !realtime.channel ||
          !matchNotifications.realtimeClient
        ) {
          return;
        }

        const existing = matchNotifications.realtimeClient.getSubscription(
          realtime.channel,
        );
        if (existing) {
          matchNotifications.realtimeClient.removeSubscription(existing);
        }

        subscription = matchNotifications.realtimeClient.newSubscription(
          realtime.channel,
          {
            token: realtime.token ?? undefined,
            getToken: async () => {
              const refreshed =
                await conversationsApi.getRealtimeToken(activeConversationId);
              if (!refreshed.enabled || !refreshed.token) {
                throw new UnauthorizedError("unauthorized");
              }

              return refreshed.token;
            },
          },
        );

        subscription.on("publication", (ctx) => {
          const event = ctx.data as RealtimeChatEvent;
          if (event.type === "message_created") {
            queryClient.setQueryData<ConversationMessagesResponse>(
              buildConversationMessagesQueryKey(activeConversationId),
              (previous) => appendMessage(previous, event.payload),
            );
            void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
            return;
          }

          if (event.type === "conversation_closed") {
            queryClient.setQueryData(
              buildConversationQueryKey(activeConversationId),
              (
                previous:
                  | Awaited<ReturnType<typeof conversationsApi.getConversation>>
                  | undefined,
              ) =>
                previous
                  ? {
                      ...previous,
                      status: event.payload.status,
                    }
                  : previous,
            );
            void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
          }
        });

        subscription.subscribe();
      } catch (error) {
        Sentry.captureException(error);
      }
    };

    void subscribeToConversation();

    return () => {
      cancelled = true;
      if (subscription && matchNotifications.realtimeClient) {
        subscription.unsubscribe();
        matchNotifications.realtimeClient.removeSubscription(subscription);
      }
    };
  }, [
    activeConversationId,
    matchNotifications?.isRealtimeEnabled,
    matchNotifications?.realtimeClient,
    queryClient,
  ]);
}
