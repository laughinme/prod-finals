import {
  Navigate,
  Outlet,
  useLocation,
  type Location,
  type RouteObject,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import HomePage from "@/pages/Home";
import ProfilePage from "@/pages/Profile/ui/ProfilePage";
import { useAuth } from "@/app/providers/auth/useAuth";
import { HeaderLayout } from "@/app/layouts/HeaderLayout";
import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { useProfile } from "@/features/profile/useProfile";
import { useQuizCompletion } from "@/features/quiz/model";

import DashboardPage from "@/pages/Dashboard";
import OnboardingPage from "@/pages/Onboarding/ui/OnboardingPage";
import ProfileSetupPage from "@/pages/ProfileSetup/ui/ProfileSetupPage";
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
  const { isOnboardingComplete } = useMatchmakingFlow();
  const { data: profile, isLoading } = useProfile();
  const { isQuizCompletedLocal } = useQuizCompletion();

  if (isLoading) {
    return <MatchmakingLoadingState />;
  }

  if (!profile?.isOnboarded && !isOnboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!profile?.quizStarted && !isQuizCompletedLocal) {
    return <Navigate to="/quiz" replace />;
  }

  return <Outlet />;
};

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "photo-upload", element: <PhotoUploadPage /> },
      { path: "profile-setup", element: <ProfileSetupPage /> },
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
            ],
          },
          { path: "profile", element: <ProfilePage /> },
          { path: "dashboard", element: <DashboardPage /> },
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
  { path: "/quiz", element: <QuizPage /> },
];
