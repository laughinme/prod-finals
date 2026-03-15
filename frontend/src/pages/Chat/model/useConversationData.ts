import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { MatchListItem } from "@/entities/match/model";
import type { MatchProfile } from "@/entities/match-profile/model";
import {
  toChatMessages,
  useConversation,
  useConversationMessages,
} from "@/features/chat/model";

type UseConversationDataParams = {
  activeConversationId: string | null;
  activeMatch: MatchListItem | null;
  fallbackProfile: MatchProfile | null;
};

export function useConversationData({
  activeConversationId,
  activeMatch,
  fallbackProfile,
}: UseConversationDataParams) {
  const { t, i18n } = useTranslation();
  const conversationQuery = useConversation(activeConversationId);
  const messagesQuery = useConversationMessages(activeConversationId);

  const peerUserId =
    conversationQuery.data?.peer.user_id ??
    activeMatch?.candidateUserId ??
    fallbackProfile?.candidateUserId ??
    null;
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

  return {
    activeChatAvatar,
    activeChatMeta,
    activeChatName,
    conversationIsClosed,
    hasActiveChat,
    isLoadingConversation,
    messages,
  };
}
