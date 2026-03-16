import type {
  ConversationMessagesResponse,
  MessageResponse,
} from "@/shared/api/conversations";

import type { ChatMessageViewModel } from "./types";

export const buildConversationQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId] as const;

export const buildConversationMessagesQueryKey = (conversationId: string | null) =>
  ["conversation", conversationId, "messages"] as const;

export const appendMessage = (
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

export const toChatMessages = (
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
