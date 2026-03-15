import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { useProfile } from "@/features/profile/useProfile";
import { useQuizCompletion } from "@/features/quiz/model";

export default function HomePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useProfile();
  const { isOnboardingComplete } = useMatchmakingFlow();
  const { isQuizCompletedLocal } = useQuizCompletion();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <p className="text-lg text-muted-foreground">{t("common.preparing_scenario")}</p>
      </div>
    );
  }

  const isPhotoDone = Boolean(profile?.profilePicUrl) || isOnboardingComplete;
  const isQuizDone = profile?.quizStarted || isQuizCompletedLocal;

  if (!isPhotoDone) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isQuizDone) {
    return <Navigate to="/quiz" replace />;
  }

  return <Navigate to="/discovery" replace />;
}
