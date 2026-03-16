import { useQuery } from "@tanstack/react-query";

import { conversationsApi } from "@/shared/api/conversations";

import { buildConversationMessagesQueryKey } from "./conversationCache";

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: buildConversationMessagesQueryKey(conversationId),
    queryFn: async () => {
      if (!conversationId) {
        throw new Error("Missing conversation id");
      }

      return conversationsApi.getMessages(conversationId);
    },
    enabled: Boolean(conversationId),
  });
}
