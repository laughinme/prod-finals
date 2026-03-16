import {
  Navigate,
  Outlet,
  useLocation,
  type RouteObject,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import HomePage from "@/pages/Home";
import ProfilePage from "@/pages/Profile/ui/ProfilePage";
import { useAuth } from "@/app/providers/auth/useAuth";
import { HeaderLayout } from "@/app/layouts/HeaderLayout";
import { useProfile } from "@/features/profile/useProfile";
import { useOnboardingState } from "@/features/quiz/model";

import DashboardPage from "@/pages/Dashboard";
import OnboardingPage from "@/pages/Onboarding/ui/OnboardingPage";
import PhotoUploadPage from "@/pages/PhotoUpload/ui/PhotoUploadPage";
import DiscoveryPage from "@/pages/Discovery/ui/DiscoveryPage";
import MatchPage from "@/pages/Match/ui/MatchPage";
import ChatPage from "@/pages/Chat/ui/ChatPage";
import MatchesPage from "@/pages/Matches/ui/MatchesPage";
import { QuizPage } from "@/pages/Onboarding/ui/QuizPage";
import RedirectIfAuthenticated from "./RedirectIfAuthenticated";

export const MatchmakingLoadingState = () => {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/20">
      <p className="text-lg text-muted-foreground">
        {t("common.loading_scenario")}
      </p>
    </div>
  );
};

export const RequireAuth = () => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth) {
    throw new Error(
      "Auth context is unavailable. Wrap routes with <AuthProvider>.",
    );
  }

  if (!auth.user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export const RequireMatchmakingReady = () => {
  const { isPending } = useProfile();
  const { data: onboardingState, isPending: isOnboardingStatePending } = useOnboardingState();

  if (isPending || isOnboardingStatePending) {
    return <MatchmakingLoadingState />;
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

  return <Outlet />;
};

export const RequireIncompleteOnboarding = () => {
  const { isPending } = useProfile();
  const { data: onboardingState, isPending: isOnboardingStatePending } = useOnboardingState();

  if (isPending || isOnboardingStatePending) {
    return <MatchmakingLoadingState />;
  }

  const currentStepKey = onboardingState?.currentStepKey ?? null;
  if (currentStepKey === "photo_upload") {
    return <Outlet />;
  }
  if (currentStepKey === "profile_basics") {
    return <Navigate to="/profile" replace />;
  }
  if (onboardingState?.shouldShow) {
    return <Navigate to="/quiz" replace />;
  }
  return <Navigate to="/discovery" replace />;
};

export const RequireIncompleteQuiz = () => {
  const { isPending } = useProfile();
  const { data: onboardingState, isPending: isOnboardingStatePending } = useOnboardingState();

  if (isPending || isOnboardingStatePending) {
    return <MatchmakingLoadingState />;
  }

  const currentStepKey = onboardingState?.currentStepKey ?? null;
  if (currentStepKey === "photo_upload") {
    return <Navigate to="/photo-upload" replace />;
  }
  if (currentStepKey === "profile_basics") {
    return <Navigate to="/profile" replace />;
  }
  if (!onboardingState?.shouldShow) {
    return <Navigate to="/discovery" replace />;
  }

  if (currentStepKey === "match_preferences" || currentStepKey === "interests" || currentStepKey === "profile_preview") {
    return <Outlet />;
  }

  return <Navigate to="/discovery" replace />;
};

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <RequireIncompleteOnboarding />,
        children: [
          { path: "onboarding", element: <OnboardingPage /> },
          { path: "photo-upload", element: <PhotoUploadPage /> },
        ],
      },
      {
        element: <RequireIncompleteQuiz />,
        children: [
          { path: "quiz", element: <QuizPage /> },
        ],
      },
      { path: "match", element: <MatchPage /> },
      {
        element: <HeaderLayout />,
        children: [
          {
            element: <RequireMatchmakingReady />,
            children: [
              { path: "discovery", element: <DiscoveryPage /> },
              { path: "chat", element: <ChatPage /> },
              { path: "matches", element: <MatchesPage /> },
              { path: "dashboard", element: <DashboardPage /> },
            ],
          },
          { path: "profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    path: "/auth",
    element: <RedirectIfAuthenticated />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
];
