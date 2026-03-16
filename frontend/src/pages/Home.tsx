import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useProfile } from "@/features/profile/useProfile";
import { useOnboardingState } from "@/features/quiz/model";

export default function HomePage() {
  const { t } = useTranslation();
  const { isLoading } = useProfile();
  const { data: onboardingState, isLoading: isOnboardingStateLoading } = useOnboardingState();

  if (isLoading || isOnboardingStateLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <p className="text-lg text-muted-foreground">{t("common.preparing_scenario")}</p>
      </div>
    );
  }

  const currentStepKey = onboardingState?.currentStepKey ?? null;
  if (currentStepKey === "photo_upload") {
    return <Navigate to="/photo-upload" replace />;
  }
  if (currentStepKey === "profile_basics") {
    return <Navigate to="/profile" replace />;
  }
  if (onboardingState?.shouldShow) {
    return <Navigate to="/quiz" replace />;
  }

  return <Navigate to="/discovery" replace />;
}
