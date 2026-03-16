import { useQuery } from "@tanstack/react-query";

import { conversationsApi } from "@/shared/api/conversations";

import { buildConversationQueryKey } from "./conversationCache";

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: buildConversationQueryKey(conversationId),
    queryFn: async () => {
      if (!conversationId) {
        throw new Error("Missing conversation id");
      }

      return conversationsApi.getConversation(conversationId);
    },
    enabled: Boolean(conversationId),
  });
}
