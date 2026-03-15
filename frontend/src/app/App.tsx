import { BrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MatchmakingFlowProvider } from "@/features/matchmaking/model";
import { useAuth } from "@/app/providers/auth/useAuth";
import { RealtimeProvider } from "@/app/providers/realtime";
import { AppRoutes } from "@/app/routes/AppRoutes";

function App() {
  const { t } = useTranslation();
  const authData = useAuth();

  if (!authData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-100">
        <div className="p-8 bg-white rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            {t("common.configuration_error")}
          </h1>
        </div>
      </div>
    );
  }

  const { isUserLoading, isRestoringSession } = authData;

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-lg text-slate-500">
          {t("common.restoring_session")}
        </p>
      </div>
    );
  }

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-lg text-slate-500">{t("common.loading_user")}</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <RealtimeProvider>
        <MatchmakingFlowProvider>
          <AppRoutes />
        </MatchmakingFlowProvider>
      </RealtimeProvider>
    </BrowserRouter>
  );
}

export default App;
