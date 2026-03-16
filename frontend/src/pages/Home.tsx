import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useProfile } from "@/features/profile/useProfile";
import {
  useOnboardingState,
  useQuizProfilePreviewState,
} from "@/features/quiz/model";

export default function HomePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useProfile();
  const { data: onboardingState, isLoading: isOnboardingStateLoading } = useOnboardingState();
  const { isProfilePreviewPending } = useQuizProfilePreviewState();

  if (isLoading || isOnboardingStateLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <p className="text-lg text-muted-foreground">{t("common.preparing_scenario")}</p>
      </div>
    );
  }

  const isPhotoDone = Boolean(profile?.profilePicUrl);
  const shouldShowQuiz = onboardingState?.shouldShow ?? false;

  if (!isPhotoDone) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isProfilePreviewPending) {
    return <Navigate to="/quiz" replace />;
  }

  if (shouldShowQuiz) {
    return <Navigate to="/quiz" replace />;
  }

  return <Navigate to="/discovery" replace />;
}
