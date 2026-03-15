import axiosInstance from "./axiosInstance";

export type MessageStatus = "sent" | "delivered" | "read";

export interface MessageResponse {
  message_id: string;
  sender_user_id: string;
  text: string;
  created_at: string;
  status: MessageStatus;
}

export interface ConversationMessagesResponse {
  items: MessageResponse[];
  next_cursor: string | null;
}

export interface ConversationRealtimeTokenResponse {
  enabled: boolean;
  channel: string | null;
  token: string | null;
  expires_at: string | null;
}

export interface ConversationReadResponse {
  conversation_id: string;
  read_at: string;
}

export type ConversationStatus =
  | "active"
  | "closed_by_user"
  | "closed_by_block"
  | "closed_by_report";

export interface ConversationPeer {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ConversationSafetyActions {
  can_block: boolean;
  can_report: boolean;
}

export interface ConversationResponse {
  conversation_id: string;
  match_id: string;
  status: ConversationStatus;
  peer: ConversationPeer;
  safety_actions: ConversationSafetyActions;
}

export type MatchStatus = "active" | "closed" | "blocked";

export interface MatchListItem {
  match_id: string;
  candidate_user_id: string;
  display_name: string;
  avatar_url: string | null;
  conversation_id: string | null;
  status: MatchStatus;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface MatchListResponse {
  items: MatchListItem[];
}

export const conversationsApi = {
  getMatches: async (): Promise<MatchListResponse> => {
    const response = await axiosInstance.get<MatchListResponse>("/matches");
    return response.data;
  },

  getConversation: async (conversationId: string): Promise<ConversationResponse> => {
    const response = await axiosInstance.get<ConversationResponse>(
      `/conversations/${conversationId}`,
    );
    return response.data;
  },

  getMessages: async (
    conversationId: string,
    cursor?: string,
    limit: number = 50,
  ): Promise<ConversationMessagesResponse> => {
    const response = await axiosInstance.get<ConversationMessagesResponse>(
      `/conversations/${conversationId}/messages`,
      {
        params: { cursor, limit },
      },
    );
    return response.data;
  },

  sendMessage: async (
    conversationId: string,
    text: string,
  ): Promise<MessageResponse> => {
    const response = await axiosInstance.post<MessageResponse>(
      `/conversations/${conversationId}/messages`,
      { text },
    );
    return response.data;
  },

  getRealtimeToken: async (
    conversationId: string,
  ): Promise<ConversationRealtimeTokenResponse> => {
    const response = await axiosInstance.get<ConversationRealtimeTokenResponse>(
      `/conversations/${conversationId}/realtime-token`,
    );
    return response.data;
  },

  markRead: async (conversationId: string): Promise<ConversationReadResponse> => {
    const response = await axiosInstance.post<ConversationReadResponse>(
      `/conversations/${conversationId}/read`,
    );
    return response.data;
  },
};
