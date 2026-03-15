import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  MoreVertical,
  Search,
  Send,
} from "lucide-react";

import { useChatPage } from "@/pages/Chat/model";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export default function ChatPage() {
  const { t } = useTranslation();
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
          <h1 className="mb-3 text-3xl font-bold">
            {t("chat.no_active_chats")}
          </h1>
          <p className="mb-8 max-w-md text-muted-foreground">
            {t("chat.no_active_chats_description")}
          </p>
          <Button
            size="lg"
            className="h-14 rounded-2xl px-8 text-base font-semibold"
            onClick={goToDiscovery}
          >
            {t("chat.back_to_discovery")}
          </Button>
        </main>
      ) : (
        <main className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
          <div className="hidden w-80 flex-col border-r border-border bg-card md:flex">
            <div className="border-b border-border p-4">
              <h2 className="mb-4 text-xl font-bold">
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

            <div className="flex-1 space-y-2 overflow-y-auto p-2">
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
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
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

            <div className="relative flex flex-1 flex-col bg-secondary/10">
              <div className="z-20 flex h-16 items-center justify-between border-b border-border bg-card px-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-foreground">
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
                    <h3 className="mb-1 leading-none font-semibold">
                    {activeChatName}
                  </h3>
                  <p className="text-xs leading-none text-muted-foreground">
                    {activeChatMeta}
                  </p>
                </div>
              </div>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
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
                      className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
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

            <div
              className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6"
            >
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
                        "max-w-[70%] rounded-2xl px-5 py-3 shadow-sm",
                        message.sender === "me"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm border border-border bg-card text-card-foreground",
                      )}
                    >
                      <p className="text-[15px] leading-relaxed">
                        {message.text}
                      </p>
                    </div>
                    <span className="mt-2 px-1 text-xs text-muted-foreground">
                      {message.time}
                    </span>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="z-10 border-t border-border bg-card p-4">
              <div className="mx-auto flex max-w-4xl items-center gap-3">
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
                  className="flex-1 rounded-xl border border-transparent bg-secondary px-4 py-4 text-[15px] outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary"
                />
                <Button
                  size="icon"
                  className="h-14 w-14 shrink-0 rounded-xl"
                  disabled={
                    conversationIsClosed ||
                    isSendingMessage ||
                    !input.trim()
                  }
                  onClick={handleSend}
                >
                  <Send className="size-5" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      )}
    </>
  );
}
