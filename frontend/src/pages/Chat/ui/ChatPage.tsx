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
    <main className="flex h-[calc(100dvh-120px)] overflow-hidden bg-background md:h-[calc(100vh-64px)]">
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
}
