import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

import {
  appendMessage,
  buildConversationMessagesQueryKey,
  useConversationRealtime,
} from "@/features/chat/model";
import { useCloseMatch } from "@/features/match";
import { MATCHES_QUERY_KEY } from "@/features/match/model/useMatches";
import {
  conversationsApi,
  type ConversationMessagesResponse,
} from "@/shared/api/conversations";
import { useActiveChat } from "./useActiveChat";
import { useConversationData } from "./useConversationData";

export function useChatPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const closeMatchMutation = useCloseMatch();
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    activeConversationId,
    activeMatch,
    fallbackProfile,
    goToDiscovery,
    isLoadingInitialChat,
    moveAwayFromMatch,
    search,
    selectMatch,
    setSearch,
    visibleMatches,
  } = useActiveChat();
  const {
    activeChatAvatar,
    activeChatMeta,
    activeChatName,
    conversationIsClosed,
    hasActiveChat,
    isLoadingConversation,
    messages,
  } = useConversationData({
    activeConversationId,
    activeMatch,
    fallbackProfile,
  });

  useConversationRealtime(activeConversationId);

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

  useEffect(() => {
    setShowMenu(false);
  }, [activeConversationId]);

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
    goToDiscovery,
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
    selectMatch,
    setInput,
    setSearch,
    showMenu,
    toggleMenu: () => setShowMenu((prevValue) => !prevValue),
    visibleMatches,
  };
}
