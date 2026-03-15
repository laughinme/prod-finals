import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UnauthorizedError, type Subscription } from "centrifuge";
import {
  MessageCircle,
  MoreVertical,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";

import type { MatchProfile } from "@/entities/match-profile/model";
import { useCloseMatch, useMatches } from "@/features/match";
import { useMatchNotifications } from "@/app/providers/realtime/useMatchNotifications";
import { Button } from "@/shared/components/ui/button";
import {
  conversationsApi,
  type ConversationMessagesResponse,
  type MessageResponse,
} from "@/shared/api/conversations";
import { cn } from "@/shared/lib/utils";
import { MATCHES_QUERY_KEY } from "@/features/match/model/useMatches";

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
        status: "active" | "closed_by_user" | "closed_by_block" | "closed_by_report";
        closed_at: string;
      };
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
  if (prevItems.some((message) => message.message_id === nextMessage.message_id)) {
    return previous ?? { items: [nextMessage], next_cursor: null };
  }
  return {
    items: [...prevItems, nextMessage].sort(
      (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at),
    ),
    next_cursor: previous?.next_cursor ?? null,
  };
};

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: matchesResponse } = useMatches();
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

  const matches = matchesResponse?.matches ?? [];
  const visibleMatches = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.status === "active" &&
          match.displayName.toLowerCase().includes(search.toLowerCase().trim()),
      ),
    [matches, search],
  );
  const activeMatch =
    visibleMatches.find((match) => match.matchId === activeMatchId) ??
    matches.find((match) => match.matchId === activeMatchId) ??
    null;
  const fallbackProfile = routeState?.matchedProfile ?? null;
  const activeConversationId = activeMatch?.conversationId ?? routeState?.conversationId ?? null;

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

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!activeConversationId) {
        throw new Error("Missing conversation id");
      }
      return conversationsApi.markRead(activeConversationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    },
  });

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
  const peerUserId = conversationQuery.data?.peer.user_id ?? activeMatch?.candidateUserId ?? null;
  const activeChatMeta =
    conversationQuery.data?.status && conversationQuery.data.status !== "active"
      ? t("chat.conversation_closed")
      : activeMatch?.lastMessageAt
        ? t("chat.recent_active")
        : t("chat.no_messages_yet");
  const conversationIsClosed =
    conversationQuery.data?.status != null && conversationQuery.data.status !== "active";
  const isLoadingConversation =
    Boolean(activeConversationId) &&
    (conversationQuery.isLoading || messagesQuery.isLoading);
  const messages = (messagesQuery.data?.items ?? []).map((message) => ({
    id: message.message_id,
    text: message.text,
    sender: message.sender_user_id === peerUserId ? "other" : "me",
    time: new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(message.created_at)),
  }));

  useEffect(() => {
    if (!activeMatchId) {
      const initialActiveMatch =
        (routeState?.matchId &&
          matches.find(
            (match) =>
              match.matchId === routeState.matchId && match.status === "active",
          )) ??
        (requestedMatchId &&
          matches.find(
            (match) =>
              match.matchId === requestedMatchId && match.status === "active",
          )) ??
        visibleMatches[0] ??
        null;

      if (initialActiveMatch) {
        setActiveMatchId(initialActiveMatch.matchId);
      }
    }
  }, [activeMatchId, matches, requestedMatchId, routeState?.matchId, visibleMatches]);

  useEffect(() => {
    if (activeMatch?.matchId) {
      void matchNotifications?.markMatchAsSeen(activeMatch.matchId);
    }
  }, [activeMatch?.matchId, matchNotifications]);

  useEffect(() => {
    matchNotifications?.setActiveConversationId(activeConversationId);
    if (activeConversationId) {
      matchNotifications?.clearConversationMessageNotifications(activeConversationId);
      void markReadMutation.mutateAsync().catch(() => undefined);
    }
    return () => {
      matchNotifications?.setActiveConversationId(null);
    };
  }, [activeConversationId, markReadMutation, matchNotifications]);

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
        const realtime = await conversationsApi.getRealtimeToken(activeConversationId);
        if (
          cancelled ||
          !realtime.enabled ||
          !realtime.channel ||
          !matchNotifications.realtimeClient
        ) {
          return;
        }

        const existing = matchNotifications.realtimeClient.getSubscription(realtime.channel);
        if (existing) {
          matchNotifications.realtimeClient.removeSubscription(existing);
        }

        subscription = matchNotifications.realtimeClient.newSubscription(realtime.channel, {
          token: realtime.token ?? undefined,
          getToken: async () => {
            const refreshed = await conversationsApi.getRealtimeToken(activeConversationId);
            if (!refreshed.enabled || !refreshed.token) {
              throw new UnauthorizedError();
            }
            return refreshed.token;
          },
        });

        subscription.on("publication", (ctx) => {
          const event = ctx.data as RealtimeChatEvent;
          if (event.type === "message_created") {
            queryClient.setQueryData<ConversationMessagesResponse>(
              buildConversationMessagesQueryKey(activeConversationId),
              (previous) => appendMessage(previous, event.payload),
            );
            if (event.payload.sender_user_id === peerUserId) {
              matchNotifications?.clearConversationMessageNotifications(activeConversationId);
              void markReadMutation.mutateAsync().catch(() => undefined);
            }
            void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
            return;
          }

          if (event.type === "conversation_closed") {
            queryClient.setQueryData(
              buildConversationQueryKey(activeConversationId),
              (previous: Awaited<
                ReturnType<typeof conversationsApi.getConversation>
              > | undefined) =>
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
      } catch {
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
    markReadMutation,
    matchNotifications,
    peerUserId,
    queryClient,
  ]);

  const handleSend = () => {
    if (!activeConversationId || !input.trim() || conversationIsClosed) {
      return;
    }
    sendMessageMutation.mutate(input.trim(), {
      onError: () => {
        window.alert(t("chat.send_message_error"));
      },
    });
    setInput("");
  };

  return (
    <>
      {!activeChatName || !activeChatAvatar ? (
        <main className="flex flex-1 flex-col items-center justify-center bg-secondary/10 p-8 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <MessageCircle className="size-10 text-primary" />
          </div>
          <h1 className="mb-3 text-3xl font-bold">{t("chat.no_active_chats")}</h1>
          <p className="mb-8 max-w-md text-muted-foreground">
            {t("chat.no_active_chats_description")}
          </p>
          <Button
            size="lg"
            className="h-14 rounded-2xl px-8 text-base font-semibold"
            onClick={() => navigate("/discovery")}
          >
            {t("chat.back_to_discovery")}
          </Button>
        </main>
      ) : (
        <main className="flex flex-1 overflow-hidden bg-background">
          <div className="hidden w-80 flex-col border-r border-border bg-card md:flex">
            <div className="border-b border-border p-4">
              <h2 className="mb-4 text-xl font-bold">{t("chat.messages_title")}</h2>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("chat.search_placeholder")}
                  className="w-full rounded-lg bg-secondary py-2 pr-4 pl-9 text-sm outline-none transition-all focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {visibleMatches.map((match) => (
                <button
                  key={match.matchId}
                  onClick={() => setActiveMatchId(match.matchId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors",
                    match.matchId === activeMatch?.matchId
                      ? "bg-secondary/50"
                      : "hover:bg-secondary/40",
                  )}
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                    <img
                      src={match.avatarUrl}
                      alt={match.displayName}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
                  </div>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="mb-1 flex items-baseline justify-between">
                      <h3 className="truncate text-sm font-semibold">{match.displayName}</h3>
                      <div className="flex items-center gap-2">
                        {match.unreadCount > 0 ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {match.unreadCount}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {match.lastMessageAt
                            ? new Intl.DateTimeFormat("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(match.lastMessageAt))
                            : ""}
                        </span>
                      </div>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {match.lastMessagePreview ?? t("chat.no_messages_yet")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex flex-1 flex-col bg-secondary/10">
            <div className="z-20 flex h-16 items-center justify-between border-b border-border bg-card px-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 overflow-hidden rounded-full">
                  <img
                    src={activeChatAvatar}
                    alt={activeChatName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="mb-1 leading-none font-semibold">{activeChatName}</h3>
                  <p className="text-xs leading-none text-muted-foreground">{activeChatMeta}</p>
                </div>
              </div>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMenu((prevValue) => !prevValue)}
                >
                  <MoreVertical className="size-5 text-muted-foreground" />
                </Button>

                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                    >
                      {activeMatch && (
                        <button
                          className="flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary"
                          onClick={async () => {
                            setShowMenu(false);

                            try {
                              await closeMatchMutation.mutateAsync({
                                matchId: activeMatch.matchId,
                                reasonCode: "not_interested",
                              });

                              const nextMatch =
                                visibleMatches.find(
                                  (match) => match.matchId !== activeMatch.matchId,
                                ) ?? null;

                              if (nextMatch) {
                                setActiveMatchId(nextMatch.matchId);
                              } else {
                                navigate("/discovery");
                              }
                            } catch {
                              window.alert(t("chat.close_match_error"));
                            }
                          }}
                        >
                          <MessageCircle className="size-4" />
                          {t("chat.close_match")}
                        </button>
                      )}
                      <button
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
                        onClick={() => {
                          setShowMenu(false);
                          window.alert(
                            t("chat.report_sent"),
                          );
                          navigate("/discovery");
                        }}
                      >
                        <ShieldAlert className="size-4" />
                        {t("chat.report_block")}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {isLoadingConversation ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t("chat.no_messages_yet")}
                </div>
              ) : (
                messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex flex-col",
                      message.sender === "me" ? "items-end" : "items-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-5 py-3 shadow-sm",
                        message.sender === "me"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm border border-border bg-card text-card-foreground",
                      )}
                    >
                      <p className="text-[15px] leading-relaxed">{message.text}</p>
                    </div>
                    <span className="mt-2 px-1 text-xs text-muted-foreground">
                      {message.time}
                    </span>
                  </motion.div>
                ))
              )}
            </div>

            <div className="z-10 border-t border-border bg-card p-4">
              <div className="mx-auto flex max-w-4xl items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={conversationIsClosed}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSend();
                    }
                  }}
                  placeholder={t("chat.write_message_placeholder")}
                  className="flex-1 rounded-xl border border-transparent bg-secondary px-4 py-4 text-[15px] outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary"
                />
                <Button
                  size="icon"
                  className="h-14 w-14 shrink-0 rounded-xl"
                  disabled={
                    conversationIsClosed || sendMessageMutation.isPending || !input.trim()
                  }
                  onClick={handleSend}
                >
                  <Send className="size-5" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      )}
    </>
  );
}
