import {
  Navigate,
  Outlet,
  useLocation,
  type RouteObject,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import HomePage from "@/pages/Home";
import ProfilePage from "@/pages/Profile";
import { useAuth } from "@/entities/auth";
import { HeaderLayout } from "@/app/layouts/HeaderLayout";
import { useProfile } from "@/features/profile";
import { useOnboardingState } from "@/features/quiz/model";

import DashboardPage from "@/pages/Dashboard";
import OnboardingPage from "@/pages/Onboarding";
import DiscoveryPage from "@/pages/Discovery";
import MatchPage from "@/pages/Match";
import ChatPage from "@/pages/Chat";
import MatchesPage from "@/pages/Matches";
import { QuizPage } from "@/pages/Onboarding";
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
  const { data: onboardingState, isPending: isOnboardingStatePending } =
    useOnboardingState();

  if (isPending || isOnboardingStatePending) {
    return <MatchmakingLoadingState />;
  }

  const currentStepKey = onboardingState?.currentStepKey ?? null;
  if (currentStepKey === "profile_basics") {
    return <Navigate to="/profile" replace />;
  }
  if (onboardingState?.shouldShow) {
    return <Navigate to="/quiz" replace />;
  }

  return <Outlet />;
};

export const RequireAdmin = () => {
  const { data: profile, isPending } = useProfile();

  if (isPending) {
    return <MatchmakingLoadingState />;
  }

  if (!profile?.roles.includes("admin")) {
    return <Navigate to="/discovery" replace />;
  }

  return <Outlet />;
};

export const RequireIncompleteOnboarding = () => {
  const { isPending } = useProfile();
  const { data: onboardingState, isPending: isOnboardingStatePending } =
    useOnboardingState();

  if (isPending || isOnboardingStatePending) {
    return <MatchmakingLoadingState />;
  }

  const currentStepKey = onboardingState?.currentStepKey ?? null;
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
  const { data: onboardingState, isPending: isOnboardingStatePending } =
    useOnboardingState();

  if (isPending || isOnboardingStatePending) {
    return <MatchmakingLoadingState />;
  }

  const currentStepKey = onboardingState?.currentStepKey ?? null;
  if (currentStepKey === "profile_basics") {
    return <Navigate to="/profile" replace />;
  }
  if (!onboardingState?.shouldShow) {
    return <Navigate to="/discovery" replace />;
  }

  if (
    currentStepKey === "goal_and_audience" ||
    currentStepKey === "interests_and_bank_signal" ||
    currentStepKey === "profile_preview"
  ) {
    return <Outlet />;
  }

  return <Navigate to="/discovery" replace />;
};

export const RequireProfileAccess = () => {
  const { isPending } = useProfile();
  const { data: onboardingState, isPending: isOnboardingStatePending } =
    useOnboardingState();

  if (isPending || isOnboardingStatePending) {
    return <MatchmakingLoadingState />;
  }

  const currentStepKey = onboardingState?.currentStepKey ?? null;
  if (currentStepKey === "profile_basics") {
    return <Outlet />;
  }

  if (onboardingState?.shouldShow) {
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
      {
        element: <RequireIncompleteOnboarding />,
        children: [
          { path: "onboarding", element: <OnboardingPage /> },
        ],
      },
      {
        element: <RequireIncompleteQuiz />,
        children: [{ path: "quiz", element: <QuizPage /> }],
      },
      { path: "match", element: <MatchPage /> },
      {
        element: <HeaderLayout />,
        children: [
          {
            element: <RequireAdmin />,
            children: [{ path: "dashboard/*", element: <DashboardPage /> }],
          },
          {
            element: <RequireMatchmakingReady />,
            children: [
              { path: "discovery", element: <DiscoveryPage /> },
              { path: "chat", element: <ChatPage /> },
              { path: "matches", element: <MatchesPage /> },
            ],
          },
          {
            element: <RequireProfileAccess />,
            children: [{ path: "profile", element: <ProfilePage /> }],
          },
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
