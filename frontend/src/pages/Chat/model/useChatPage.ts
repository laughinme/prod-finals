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
import { useBlockUser, useReportUser } from "@/features/safety";
import {
  conversationsApi,
  type ConversationMessagesResponse,
} from "@/shared/api/conversations";
import { FEED_REFRESH_EVENT } from "@/features/matchmaking/model/useFeed";
import { useActiveChat } from "./useActiveChat";
import { useConversationData } from "./useConversationData";

export function useChatPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const closeMatchMutation = useCloseMatch();
  const blockUserMutation = useBlockUser();
  const reportUserMutation = useReportUser();
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
    conversationSafetyActions,
    hasActiveChat,
    isLoadingConversation,
    messages,
    peerUserId,
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

  const handleBlockUser = async () => {
    if (!activeMatch || !peerUserId || blockUserMutation.isPending) {
      return;
    }

    setShowMenu(false);

    try {
      await blockUserMutation.mutateAsync({
        targetUserId: peerUserId,
        sourceContext: "conversation",
        reasonCode: "unwanted_contact",
      });
      await queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
      window.dispatchEvent(new Event(FEED_REFRESH_EVENT));
      moveAwayFromMatch(activeMatch.matchId);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t("safety.block_error"));
    }
  };

  const handleReportUser = async () => {
    if (!activeMatch || !peerUserId || reportUserMutation.isPending) {
      return;
    }

    setShowMenu(false);

    try {
      await reportUserMutation.mutateAsync({
        targetUserId: peerUserId,
        sourceContext: "conversation",
        category: "other",
        alsoBlock: true,
      });
      await queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
      window.dispatchEvent(new Event(FEED_REFRESH_EVENT));
      moveAwayFromMatch(activeMatch.matchId);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t("safety.report_error"));
    }
  };

  const hasAnyChats = visibleMatches.length > 0;

  return {
    activeChatAvatar,
    activeChatInitial: activeChatName?.charAt(0).toUpperCase() ?? null,
    activeChatMeta,
    activeChatName,
    activeMatch,
    conversationIsClosed,
    conversationSafetyActions,
    goToDiscovery,
    handleBlockUser,
    handleCloseMatch,
    handleReportUser,
    handleSend,
    hasActiveChat,
    hasAnyChats,
    input,
    isBlockingUser: blockUserMutation.isPending,
    isClosingMatch: closeMatchMutation.isPending,
    isLoadingConversation,
    isLoadingInitialChat,
    isReportingUser: reportUserMutation.isPending,
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
