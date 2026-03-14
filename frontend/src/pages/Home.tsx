import { Navigate } from "react-router-dom";

import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { useProfile } from "@/features/profile/useProfile";

export default function HomePage() {
  const { data: profile, isLoading } = useProfile();
  const { isOnboardingComplete } = useMatchmakingFlow();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/20">
        <p className="text-lg text-muted-foreground">Подготавливаем сценарий...</p>
      </div>
    );
  }

  const shouldOpenDiscovery = profile?.isOnboarded || isOnboardingComplete;

  return <Navigate to={shouldOpenDiscovery ? "/discovery" : "/onboarding"} replace />;
}
