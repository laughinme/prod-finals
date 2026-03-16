import type { MessageResponse } from "@/shared/api/conversations";

export type RealtimeChatEvent =
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

export type ChatMessageViewModel = {
  id: string;
  text: string;
  sender: "me" | "other";
  time: string;
};
