import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  MessageCircle,
  MoreVertical,
  Search,
  Send,
} from "lucide-react";

import { useChatPage } from "@/pages/Chat/model";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";

export default function ChatPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    activeChatAvatar,
    activeChatInitial,
    activeChatMeta,
    activeChatName,
    activeMatch,
    conversationIsClosed,
    goToDiscovery,
    handleCloseMatch,
    handleSend,
    hasActiveChat,
    input,
    isClosingMatch,
    isLoadingConversation,
    isLoadingInitialChat,
    isSendingMessage,
    messages,
    messagesEndRef,
    search,
    selectMatch,
    setInput,
    setSearch,
    showMenu,
    toggleMenu,
    visibleMatches,
  } = useChatPage();

  // On mobile, if a chat is selected, we show only the chat (not the sidebar)
  const showSidebar = !isMobile || !activeMatch;
  const showChat = !isMobile || !!activeMatch;

  const handleBack = () => {
    selectMatch(null);
  };

  return (
    <>
      {isLoadingInitialChat && !hasActiveChat ? (
        <main className="flex flex-1 flex-col items-center justify-center bg-secondary/10 p-8 text-center">
          <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
        </main>
      ) : !hasActiveChat ? (
        <main className="flex flex-1 flex-col items-center justify-center bg-secondary/10 p-8 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <MessageCircle className="size-10 text-primary" />
          </div>
          <h1 className="mb-3 text-2xl font-bold md:text-3xl">
            {t("chat.no_active_chats")}
          </h1>
          <p className="mb-8 max-w-md text-sm text-muted-foreground md:text-base">
            {t("chat.no_active_chats_description")}
          </p>
          <Button
            size="lg"
            className="h-12 rounded-2xl px-6 text-sm font-semibold md:h-14 md:px-8 md:text-base"
            onClick={goToDiscovery}
          >
            {t("chat.back_to_discovery")}
          </Button>
        </main>
      ) : (
        <main className="flex h-[calc(100dvh-120px)] overflow-hidden bg-background md:h-[calc(100vh-64px)]">
          {/* Sidebar — full width on mobile, fixed width on desktop */}
          {showSidebar && (
            <div className="flex w-full flex-col border-r border-border bg-card md:w-80">
              <div className="border-b border-border p-3 md:p-4">
                <h2 className="mb-3 text-lg font-bold md:mb-4 md:text-xl">
                  {t("chat.messages_title")}
                </h2>
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

              <div className="flex-1 space-y-1 overflow-y-auto p-2">
                {visibleMatches.map((match) => (
                  <button
                    key={match.matchId}
                    onClick={() => selectMatch(match.matchId)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors",
                      match.matchId === activeMatch?.matchId
                        ? "bg-secondary/50"
                        : "hover:bg-secondary/40",
                    )}
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full md:h-12 md:w-12">
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
                        <h3 className="truncate text-sm font-semibold">
                          {match.displayName}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {match.lastMessageAt
                            ? new Intl.DateTimeFormat("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(match.lastMessageAt))
                            : ""}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {match.lastMessagePreview ?? t("chat.no_messages_yet")}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat area */}
          {showChat && (
            <div className="relative flex flex-1 flex-col bg-secondary/10">
              <div className="z-20 flex h-14 items-center justify-between border-b border-border bg-card px-3 md:h-16 md:px-6">
                <div className="flex items-center gap-3 md:gap-4">
                  {/* Back button on mobile */}
                  {isMobile && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                    >
                      <ArrowLeft className="size-5" />
                    </button>
                  )}
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-foreground md:h-10 md:w-10">
                    {activeChatAvatar ? (
                      <img
                        src={activeChatAvatar}
                        alt={activeChatName ?? ""}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      activeChatInitial
                    )}
                  </div>
                  <div>
                    <h3 className="mb-0.5 text-sm font-semibold leading-none md:mb-1 md:text-base">
                      {activeChatName}
                    </h3>
                    <p className="text-[11px] leading-none text-muted-foreground md:text-xs">
                      {activeChatMeta}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 md:h-10 md:w-10"
                    onClick={toggleMenu}
                  >
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
                            onClick={() => void handleCloseMatch()}
                          >
                            <MessageCircle className="size-4" />
                            {t("chat.close_match")}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:space-y-6 md:p-6">
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
                          "max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm md:max-w-[70%] md:px-5 md:py-3",
                          message.sender === "me"
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border bg-card text-card-foreground",
                        )}
                      >
                        <p className="text-sm leading-relaxed md:text-[15px]">
                          {message.text}
                        </p>
                      </div>
                      <span className="mt-1.5 px-1 text-[11px] text-muted-foreground md:mt-2 md:text-xs">
                        {message.time}
                      </span>
                    </motion.div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="z-10 border-t border-border bg-card p-3 md:p-4">
                <div className="mx-auto flex max-w-4xl items-center gap-2 md:gap-3">
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
                    className="flex-1 rounded-xl border border-transparent bg-secondary px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary md:py-4 md:text-[15px]"
                  />
                  <Button
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl md:h-14 md:w-14"
                    disabled={
                      conversationIsClosed ||
                      isSendingMessage ||
                      !input.trim()
                    }
                    onClick={handleSend}
                  >
                    <Send className="size-4.5 md:size-5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </>
  );
}
