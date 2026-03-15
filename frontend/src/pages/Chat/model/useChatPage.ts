import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UnauthorizedError, type Subscription } from "centrifuge";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

import type { MatchProfile } from "@/entities/match-profile/model";
import { useCloseMatch, useMatches } from "@/features/match";
import { MATCHES_QUERY_KEY } from "@/features/match/model/useMatches";
import { useMatchNotifications } from "@/app/providers/realtime/useMatchNotifications";
import {
  conversationsApi,
  type ConversationMessagesResponse,
  type MessageResponse,
} from "@/shared/api/conversations";

type ChatNavigationState = {
  matchedProfile?: MatchProfile;
  matchId?: string | null;
  conversationId?: string | null;
};

type RealtimeChatEvent =
  | {
      type: "message_created";
      payload: MessageResponse & { conversation_id: string };
    }
  | {
      type: "conversation_closed";
      payload: {
        conversation_id: string;
        status:
          | "active"
          | "closed_by_user"
          | "closed_by_block"
          | "closed_by_report";
        closed_at: string;
      };
    };

type ChatMessageViewModel = {
  id: string;
  text: string;
  sender: "me" | "other";
  time: string;
};

const buildConversationQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId] as const;

const buildConversationMessagesQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId, "messages"] as const;

const appendMessage = (
  previous: ConversationMessagesResponse | undefined,
  nextMessage: MessageResponse,
): ConversationMessagesResponse => {
  const prevItems = previous?.items ?? [];
  if (
    prevItems.some((message) => message.message_id === nextMessage.message_id)
  ) {
    return previous ?? { items: [nextMessage], next_cursor: null };
  }

  return {
    items: [...prevItems, nextMessage].sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at),
    ),
    next_cursor: previous?.next_cursor ?? null,
  };
};

const toChatMessages = (
  items: MessageResponse[],
  peerUserId: string | null,
  locale?: string,
): ChatMessageViewModel[] =>
  [...items]
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at),
    )
    .map((message) => ({
      id: message.message_id,
      text: message.text,
      sender: message.sender_user_id === peerUserId ? "other" : "me",
      time: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(message.created_at)),
    }));

export function useChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { data: matchesResponse, isLoading: isLoadingMatches } = useMatches();
  const matchNotifications = useMatchNotifications();
  const closeMatchMutation = useCloseMatch();
  const routeState = location.state as ChatNavigationState | null;
  const requestedMatchId = searchParams.get("match");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(
    routeState?.matchId ?? requestedMatchId ?? null,
  );
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const matches = matchesResponse?.matches;
  const activeMatches = useMemo(
    () => (matches ?? []).filter((match) => match.status === "active"),
    [matches],
  );
  const visibleMatches = useMemo(
    () =>
      activeMatches.filter((match) =>
        match.displayName.toLowerCase().includes(search.toLowerCase().trim()),
      ),
    [activeMatches, search],
  );
  const activeMatch =
    visibleMatches.find((match) => match.matchId === activeMatchId) ??
    activeMatches.find((match) => match.matchId === activeMatchId) ??
    null;
  const fallbackProfile = routeState?.matchedProfile ?? null;
  const activeConversationId =
    activeMatch?.conversationId ?? routeState?.conversationId ?? null;

  const conversationQuery = useQuery({
    queryKey: buildConversationQueryKey(activeConversationId),
    queryFn: async () => {
      if (!activeConversationId) {
        throw new Error("Missing conversation id");
      }

      return conversationsApi.getConversation(activeConversationId);
    },
    enabled: Boolean(activeConversationId),
  });

  const messagesQuery = useQuery({
    queryKey: buildConversationMessagesQueryKey(activeConversationId),
    queryFn: async () => {
      if (!activeConversationId) {
        throw new Error("Missing conversation id");
      }

      return conversationsApi.getMessages(activeConversationId);
    },
    enabled: Boolean(activeConversationId),
  });

  const peerUserId =
    conversationQuery.data?.peer.user_id ??
    activeMatch?.candidateUserId ??
    fallbackProfile?.candidateUserId ??
    null;

  const moveAwayFromMatch = (matchId: string) => {
    const nextMatch =
      visibleMatches.find((match) => match.matchId !== matchId) ??
      activeMatches.find((match) => match.matchId !== matchId) ??
      null;

    if (nextMatch) {
      setActiveMatchId(nextMatch.matchId);
      return;
    }

    setActiveMatchId(null);
    navigate("/discovery");
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!activeConversationId) {
        throw new Error("Missing conversation id");
      }

      return conversationsApi.sendMessage(activeConversationId, text);
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ConversationMessagesResponse>(
        buildConversationMessagesQueryKey(activeConversationId),
        (previous) => appendMessage(previous, message),
      );
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    },
    onError: (error) => {
      Sentry.captureException(error);
      toast.error(t("chat.send_message_error"));
    },
  });

  const activeChatName =
    conversationQuery.data?.peer.display_name ??
    activeMatch?.displayName ??
    fallbackProfile?.name ??
    null;
  const activeChatAvatar =
    conversationQuery.data?.peer.avatar_url ??
    activeMatch?.avatarUrl ??
    fallbackProfile?.image ??
    null;
  const activeChatMeta =
    conversationQuery.data?.status && conversationQuery.data.status !== "active"
      ? t("chat.conversation_closed")
      : activeMatch?.lastMessageAt || (messagesQuery.data?.items.length ?? 0) > 0
        ? t("chat.recent_active")
        : t("chat.no_messages_yet");
  const conversationIsClosed =
    conversationQuery.data?.status != null &&
    conversationQuery.data.status !== "active";
  const isLoadingConversation =
    Boolean(activeConversationId) &&
    (conversationQuery.isLoading || messagesQuery.isLoading);
  const isLoadingInitialChat = isLoadingMatches && !matchesResponse;
  const hasActiveChat = Boolean(activeChatName);
  const messages = useMemo(
    () =>
      toChatMessages(
        messagesQuery.data?.items ?? [],
        peerUserId,
        i18n.resolvedLanguage,
      ),
    [i18n.resolvedLanguage, messagesQuery.data?.items, peerUserId],
  );

  useEffect(() => {
    const hasSelectedActiveMatch =
      activeMatchId != null &&
      activeMatches.some((match) => match.matchId === activeMatchId);

    if (hasSelectedActiveMatch) {
      return;
    }

    const initialActiveMatch =
      (routeState?.matchId &&
        activeMatches.find((match) => match.matchId === routeState.matchId)) ??
      (requestedMatchId &&
        activeMatches.find((match) => match.matchId === requestedMatchId)) ??
      visibleMatches[0] ??
      activeMatches[0] ??
      null;

    if (initialActiveMatch) {
      setActiveMatchId(initialActiveMatch.matchId);
      return;
    }

    if (!routeState?.conversationId) {
      setActiveMatchId(null);
    }
  }, [
    activeMatchId,
    activeMatches,
    requestedMatchId,
    routeState?.conversationId,
    routeState?.matchId,
    visibleMatches,
  ]);

  useEffect(() => {
    if (activeMatch?.matchId) {
      void matchNotifications?.markMatchAsSeen(activeMatch.matchId);
    }
  }, [activeMatch?.matchId, matchNotifications]);

  useEffect(() => {
    setShowMenu(false);
  }, [activeMatchId]);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (
      !activeConversationId ||
      !trimmedInput ||
      conversationIsClosed ||
      sendMessageMutation.isPending
    ) {
      return;
    }

    sendMessageMutation.mutate(trimmedInput, {
      onSuccess: () => {
        setInput("");
      },
    });
  };

  const handleCloseMatch = async () => {
    if (!activeMatch || closeMatchMutation.isPending) {
      return;
    }

    setShowMenu(false);

    try {
      await closeMatchMutation.mutateAsync({
        matchId: activeMatch.matchId,
        reasonCode: "not_interested",
      });
      moveAwayFromMatch(activeMatch.matchId);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t("chat.close_match_error"));
    }
  };

  return {
    activeChatAvatar,
    activeChatInitial: activeChatName?.charAt(0).toUpperCase() ?? null,
    activeChatMeta,
    activeChatName,
    activeMatch,
    conversationIsClosed,
    goToDiscovery: () => navigate("/discovery"),
    handleCloseMatch,
    handleSend,
    hasActiveChat,
    input,
    isClosingMatch: closeMatchMutation.isPending,
    isLoadingConversation,
    isLoadingInitialChat,
    isSendingMessage: sendMessageMutation.isPending,
    messages,
    messagesEndRef,
    search,
    selectMatch: (matchId: string) => setActiveMatchId(matchId),
    setInput,
    setSearch,
    showMenu,
    toggleMenu: () => setShowMenu((prevValue) => !prevValue),
    visibleMatches,
  };
}
