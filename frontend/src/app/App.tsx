import { type ReactNode, useEffect, useRef } from "react";
import { BrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { MatchmakingFlowProvider } from "@/features/matchmaking/model";
import { useAuth } from "@/entities/auth";
import { OfflineBlocker } from "@/app/components/OfflineBlocker";
import { RealtimeProvider } from "@/app/providers/realtime";
import { AppRoutes } from "@/app/routes/AppRoutes";
import { useNetworkStatus } from "@/shared/lib/network/useNetworkStatus";

function App() {
  const { t } = useTranslation();
  const authData = useAuth();
  const appShellRef = useRef<HTMLDivElement>(null);
  const { isBlockingConnectionIssue } = useNetworkStatus();

  useEffect(() => {
    const appShell = appShellRef.current;
    if (!appShell) {
      return;
    }

    if (isBlockingConnectionIssue) {
      appShell.setAttribute("inert", "");
    } else {
      appShell.removeAttribute("inert");
    }

    return () => {
      appShell.removeAttribute("inert");
    };
  }, [isBlockingConnectionIssue]);

  let content: ReactNode;

  if (!authData) {
    content = (
      <div className="min-h-screen flex items-center justify-center bg-red-100">
        <div className="p-8 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            {t("common.configuration_error")}
          </h1>
        </div>
      </div>
    );
  } else {
    const { isUserLoading, isRestoringSession } = authData;

    if (isRestoringSession) {
      content = (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-lg text-slate-500">
            {t("common.restoring_session")}
          </p>
        </div>
      );
    } else if (isUserLoading) {
      content = (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <p className="text-lg text-slate-500">{t("common.loading_user")}</p>
        </div>
      );
    } else {
      content = (
        <BrowserRouter>
          <RealtimeProvider>
            <MatchmakingFlowProvider>
              <AppRoutes />
            </MatchmakingFlowProvider>
          </RealtimeProvider>
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      );
    }
  }

  return (
    <>
      <div ref={appShellRef} aria-hidden={isBlockingConnectionIssue}>
        {content}
      </div>
      <OfflineBlocker />
    </>
  );
}

export default App;
