import { useEffect } from "react";

import { useIsMobile } from "@/shared/hooks/use-mobile";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { DiscoveryDemoPanel } from "@/widgets/DiscoveryDemoPanel";
import { MatchmakingDeck } from "@/widgets/MatchmakingDeck";
import { useDiscoveryPage } from "../model";

export default function DiscoveryPage() {
  const isMobile = useIsMobile();
  const discovery = useDiscoveryPage();

  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile]);

  return (
    <main className="relative flex h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden bg-secondary/20 p-0 md:h-[calc(100dvh-5rem)] md:p-8">
      <ErrorBoundary compact title="Не удалось загрузить демо-панель">
        <DiscoveryDemoPanel
          demoShortcuts={discovery.demoShortcuts}
          activeDemoShortcutKey={discovery.activeDemoShortcutKey}
          onOpenShortcut={discovery.openDemoShortcut}
          onCloseShortcut={discovery.closeDemoShortcut}
          onResetShortcut={(key) => void discovery.handleResetDemoPair(key)}
          isResettingShortcut={discovery.isResettingDemoPair}
        />
      </ErrorBoundary>

      <ErrorBoundary title="Не удалось загрузить ленту" description="Попробуйте обновить страницу, чтобы продолжить знакомства.">
        <MatchmakingDeck
          currentProfile={discovery.currentProfile}
          nextProfiles={discovery.nextProfiles}
          isFeedLoading={discovery.isFeedLoading}
          isMobile={isMobile}
          exitX={discovery.exitX}
          showReport={discovery.showReport}
          showPhotoGate={discovery.showPhotoGate}
          isSafetyPending={discovery.isSafetyPending}
          isPhotoGatePending={discovery.isPhotoGatePending}
          isPreparingTestMatch={discovery.isPreparingTestMatch}
          onLike={discovery.handleLike}
          onPass={discovery.handlePass}
          onOpenReport={discovery.openReport}
          onCloseReport={discovery.closeReport}
          onPrepareTestMatch={discovery.handlePrepareTestMatch}
          onBlock={discovery.handleBlock}
          onReport={discovery.handleReport}
          onClosePhotoGate={discovery.closePhotoGate}
          onUseDefaultPhoto={discovery.handleUseDefaultPhoto}
          onUploadPhoto={discovery.handleUploadPhoto}
        />
      </ErrorBoundary>
    </main>
  );
}
