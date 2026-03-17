import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";

import { useChatPage } from "@/pages/Chat/model";
import { Button } from "@/shared/components/ui/button";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { ChatSidebar } from "@/widgets/ChatSidebar";
import { ChatWindow } from "@/widgets/ChatWindow";

const mobileSlide = {
  sidebar: {
    initial: { x: "-40%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "-40%", opacity: 0 },
    transition: { duration: 0.15, ease: "easeOut" },
  },
  chat: {
    initial: { x: "40%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "40%", opacity: 0 },
    transition: { duration: 0.15, ease: "easeOut" },
  },
} as const;

export default function ChatPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const chat = useChatPage();

  const showSidebar = !isMobile || !chat.hasActiveChat;
  const showChat = !isMobile || chat.hasActiveChat;

  const handleBack = () => {
    chat.selectMatch(null);
  };

  if (chat.isLoadingInitialChat && !chat.hasAnyChats && !chat.hasActiveChat) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-secondary/10 p-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-muted-foreground"
        >
          {t("common.loading")}
        </motion.div>
      </main>
    );
  }

  if (!chat.hasAnyChats && !chat.hasActiveChat) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center bg-secondary/10 p-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center"
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <MessageCircle className="size-10 text-primary" />
          </div>
          <h1 className="mb-3 text-2xl font-bold md:text-3xl">{t("chat.no_active_chats")}</h1>
          <p className="mb-8 max-w-md text-sm text-muted-foreground md:text-base">
            {t("chat.no_active_chats_description")}
          </p>
          <Button
            size="lg"
            className="h-12 rounded-2xl px-6 text-sm font-semibold md:h-14 md:px-8 md:text-base"
            onClick={chat.goToDiscovery}
          >
            {t("chat.back_to_discovery")}
          </Button>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex h-[calc(100dvh-48px)] overflow-hidden bg-background md:h-[calc(100vh-64px)]">
      {isMobile ? (
        <AnimatePresence mode="wait" initial={false}>
          {showSidebar ? (
            <motion.div
              key="sidebar"
              {...mobileSlide.sidebar}
              className="flex w-full flex-col border-r border-border bg-card"
            >
              <ErrorBoundary compact title="Не удалось загрузить список чатов">
                <ChatSidebar
                  search={chat.search}
                  setSearch={chat.setSearch}
                  visibleMatches={chat.visibleMatches}
                  activeMatchId={chat.activeMatch?.matchId}
                  onSelectMatch={chat.selectMatch}
                />
              </ErrorBoundary>
            </motion.div>
          ) : showChat ? (
            <motion.div
              key="chat"
              {...mobileSlide.chat}
              className="relative flex w-full flex-col bg-secondary/10"
            >
              <ErrorBoundary compact title="Не удалось отобразить чат">
                <ChatWindow
                  isMobile={isMobile}
                  onBack={handleBack}
                  activeChatAvatar={chat.activeChatAvatar}
                  activeChatName={chat.activeChatName}
                  activeChatMeta={chat.activeChatMeta}
                  showMenu={chat.showMenu}
                  toggleMenu={chat.toggleMenu}
                  activeMatch={chat.activeMatch}
                  isClosingMatch={chat.isClosingMatch}
                  onCloseMatch={chat.handleCloseMatch}
                  conversationSafetyActions={chat.conversationSafetyActions}
                  isBlockingUser={chat.isBlockingUser}
                  onBlockUser={chat.handleBlockUser}
                  isReportingUser={chat.isReportingUser}
                  onReportUser={chat.handleReportUser}
                  isLoadingConversation={chat.isLoadingConversation}
                  messages={chat.messages}
                  messagesEndRef={chat.messagesEndRef}
                  conversationIsClosed={chat.conversationIsClosed}
                  input={chat.input}
                  setInput={chat.setInput}
                  isSendingMessage={chat.isSendingMessage}
                  onSend={chat.handleSend}
                />
              </ErrorBoundary>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex w-80 flex-col border-r border-border bg-card"
          >
            <ErrorBoundary compact title="Не удалось загрузить список чатов">
              <ChatSidebar
                search={chat.search}
                setSearch={chat.setSearch}
                visibleMatches={chat.visibleMatches}
                activeMatchId={chat.activeMatch?.matchId}
                onSelectMatch={chat.selectMatch}
              />
            </ErrorBoundary>
          </motion.div>

          <div className="relative flex flex-1 flex-col bg-secondary/10">
            <ErrorBoundary compact title="Не удалось отобразить чат">
              <ChatWindow
                isMobile={isMobile}
                onBack={handleBack}
                activeChatAvatar={chat.activeChatAvatar}
                activeChatName={chat.activeChatName}
                activeChatMeta={chat.activeChatMeta}
                showMenu={chat.showMenu}
                toggleMenu={chat.toggleMenu}
                activeMatch={chat.activeMatch}
                isClosingMatch={chat.isClosingMatch}
                onCloseMatch={chat.handleCloseMatch}
                conversationSafetyActions={chat.conversationSafetyActions}
                isBlockingUser={chat.isBlockingUser}
                onBlockUser={chat.handleBlockUser}
                isReportingUser={chat.isReportingUser}
                onReportUser={chat.handleReportUser}
                isLoadingConversation={chat.isLoadingConversation}
                messages={chat.messages}
                messagesEndRef={chat.messagesEndRef}
                conversationIsClosed={chat.conversationIsClosed}
                input={chat.input}
                setInput={chat.setInput}
                isSendingMessage={chat.isSendingMessage}
                onSend={chat.handleSend}
              />
            </ErrorBoundary>
          </div>
        </>
      )}
    </main>
  );

  const chatContent = (
    <>
      <div className="z-20 flex h-14 items-center justify-between border-b border-border bg-card px-3 md:h-16 md:px-6">
        <div className="flex items-center gap-3 md:gap-4">
          {isMobile && (
            <motion.button
              type="button"
              onClick={handleBack}
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
                    <IconXFilled className="size-5" />
                    {t("chat.close_match")}
                  </button>
                )}
                {conversationSafetyActions?.can_block ? (
                  <button
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                    disabled={isBlockingUser}
                    onClick={() => void handleBlockUser()}
                  >
                    <BadgeXIcon className="size-5" />
                    {t("chat.block_user")}
                  </button>
                ) : null}
                {conversationSafetyActions?.can_report ? (
                  <button
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                    disabled={isReportingUser}
                    onClick={() => void handleReportUser()}
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
              className={cn(
                "flex flex-col",
                message.sender === "me" ? "items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "w-fit max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 shadow-sm wrap-anywhere md:max-w-[70%] md:px-5 md:py-3",
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
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("chat.write_message_placeholder")}
            className="min-h-11 max-h-35 flex-1 resize-none rounded-2xl border border-transparent bg-secondary px-4 py-3 text-sm leading-relaxed outline-none transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary md:min-h-14 md:max-h-45 md:py-4 md:text-[15px]"
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl md:h-14 md:w-14"
            disabled={conversationIsClosed || isSendingMessage || !input.trim()}
            onClick={handleSend}
          >
            <Send className="size-4.5 md:size-5" />
          </Button>
        </div>
      </motion.div>
    </>
  );

  return (
    <main className="flex h-[calc(100dvh-120px)] overflow-hidden bg-background md:h-[calc(100vh-64px)]">
      {isMobile ? (
        <AnimatePresence mode="wait" initial={false}>
          {showSidebar ? (
            <motion.div
              key="sidebar"
              {...mobileSlide.sidebar}
              className="flex w-full flex-col border-r border-border bg-card"
            >
              {sidebarContent}
            </motion.div>
          ) : showChat ? (
            <motion.div
              key="chat"
              {...mobileSlide.chat}
              className="relative flex w-full flex-col bg-secondary/10"
            >
              {chatContent}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex w-80 flex-col border-r border-border bg-card"
          >
            {sidebarContent}
          </motion.div>

          <div className="relative flex flex-1 flex-col bg-secondary/10">
            {chatContent}
          </div>
        </>
      )}
    </main>
  );
}
