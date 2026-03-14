import { Navigate, useLocation, type Location } from "react-router-dom";
import { useAuth } from "@/app/providers/auth/useAuth";
import AuthPage from "@/pages/auth/ui/AuthPage";

const RedirectIfAuthenticated = () => {
  const auth = useAuth();
  const location = useLocation();

  if (!auth) {
    throw new Error(
      "Auth context is unavailable. Wrap routes with <AuthProvider>.",
    );
  }

  if (auth.user) {
    const state = location.state as { from?: Location } | undefined;
    const from = state?.from;
    const targetPath =
      from && from.pathname && from.pathname !== "/auth" ? from.pathname : "/";

    return <Navigate to={targetPath} replace />;
  }

  return <AuthPage />;
};

export default RedirectIfAuthenticated;
