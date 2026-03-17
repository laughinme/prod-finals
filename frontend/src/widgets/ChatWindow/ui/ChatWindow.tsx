import { useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BadgeXIcon,
  MessageCircle,
  MessageCircleWarningIcon,
  MoreVertical,
  Send,
} from "lucide-react";
import { IconUserCircle, IconXFilled } from "@tabler/icons-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import type { MatchListItem } from "@/entities/match/model/types";
import type { ChatMessageViewModel } from "@/features/chat/model/types";
import type { ConversationSafetyActions } from "@/shared/api/conversations";

interface ChatWindowProps {
  isMobile: boolean;
  onBack: () => void;
  activeChatAvatar: string | null;
  activeChatName: string | null;
  activeChatMeta: string | null;
  showMenu: boolean;
  toggleMenu: () => void;
  activeMatch: MatchListItem | null;
  isClosingMatch: boolean;
  onCloseMatch: () => void;
  conversationSafetyActions: ConversationSafetyActions | null;
  isBlockingUser: boolean;
  onBlockUser: () => void;
  isReportingUser: boolean;
  onReportUser: () => void;
  isLoadingConversation: boolean;
  messages: ChatMessageViewModel[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationIsClosed: boolean;
  input: string;
  setInput: (value: string) => void;
  isSendingMessage: boolean;
  onSend: () => void;
}

export function ChatWindow({
  isMobile,
  onBack,
  activeChatAvatar,
  activeChatName,
  activeChatMeta,
  showMenu,
  toggleMenu,
  activeMatch,
  isClosingMatch,
  onCloseMatch,
  conversationSafetyActions,
  isBlockingUser,
  onBlockUser,
  isReportingUser,
  onReportUser,
  isLoadingConversation,
  messages,
  messagesEndRef,
  conversationIsClosed,
  input,
  setInput,
  isSendingMessage,
  onSend,
}: ChatWindowProps) {
  const { t } = useTranslation();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const maxComposerHeight = isMobile ? 140 : 180;

  useLayoutEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.style.height = "0px";
    const nextHeight = Math.min(composer.scrollHeight, maxComposerHeight);
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > maxComposerHeight ? "auto" : "hidden";
  }, [input, maxComposerHeight]);

  return (
    <>
      <div className="z-20 flex h-14 items-center justify-between border-b border-border bg-card px-3 md:h-16 md:px-6">
        <div className="flex items-center gap-3 md:gap-4">
          {isMobile && (
            <motion.button
              type="button"
              onClick={onBack}
              whileTap={{ scale: 0.9 }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="size-5" />
            </motion.button>
          )}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-foreground md:h-10 md:w-10"
          >
            {activeChatAvatar ? (
              <img
                src={activeChatAvatar}
                alt={activeChatName ?? ""}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <IconUserCircle className="size-7 text-muted-foreground/70 md:size-8" />
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: 0.03 }}
          >
            <h3 className="mb-0.5 text-sm font-semibold leading-none md:mb-1 md:text-base">
              {activeChatName}
            </h3>
            <p className="text-[11px] leading-none text-muted-foreground md:text-xs">
              {activeChatMeta}
            </p>
          </motion.div>
        </div>

        <div className="relative">
          <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10" onClick={toggleMenu}>
            <MoreVertical className="size-5 text-muted-foreground" />
          </Button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg md:w-64"
              >
                {activeMatch && (
                  <button
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                    disabled={isClosingMatch}
                    onClick={onCloseMatch}
                  >
                    <IconXFilled className="size-5" />
                    {t("chat.close_match")}
                  </button>
                )}
                {conversationSafetyActions?.can_block ? (
                  <button
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                    disabled={isBlockingUser}
                    onClick={onBlockUser}
                  >
                    <BadgeXIcon className="size-5" />
                    {t("chat.block_user")}
                  </button>
                ) : null}
                {conversationSafetyActions?.can_report ? (
                  <button
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                    disabled={isReportingUser}
                    onClick={onReportUser}
                  >
                    <MessageCircleWarningIcon className="size-5" />
                    {t("chat.report_user")}
                  </button>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:space-y-6 md:p-6">
        {isLoadingConversation ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full items-center justify-center text-sm text-muted-foreground"
          >
            {t("common.loading")}
          </motion.div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <MessageCircle className="size-8 opacity-40" />
            {t("chat.no_messages_yet")}
          </motion.div>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.02, duration: 0.15 }}
              className={cn("flex flex-col", message.sender === "me" ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "w-fit max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 shadow-sm wrap-anywhere md:max-w-[70%] md:px-5 md:py-3",
                  message.sender === "me"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border border-border bg-card text-card-foreground",
                )}
              >
                <p className="text-sm leading-relaxed md:text-[15px]">{message.text}</p>
              </div>
              <span className="mt-1.5 px-1 text-[11px] text-muted-foreground md:mt-2 md:text-xs">
                {message.time}
              </span>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.15 }}
        className="z-10 border-t border-border bg-card p-3 md:p-4"
      >
        <div className="mx-auto flex max-w-4xl items-end gap-2 md:gap-3">
          <textarea
            ref={composerRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={conversationIsClosed}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={t("chat.write_message_placeholder")}
            className="min-h-11 max-h-35 flex-1 resize-none rounded-2xl border border-transparent bg-secondary px-4 py-3 text-base leading-relaxed outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary md:min-h-14 md:max-h-45 md:py-4 md:text-[15px]"
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl md:h-14 md:w-14"
            disabled={conversationIsClosed || isSendingMessage || !input.trim()}
            onClick={onSend}
          >
            <Send className="size-4.5 md:size-5" />
          </Button>
        </div>
      </motion.div>
    </>
  );
}
