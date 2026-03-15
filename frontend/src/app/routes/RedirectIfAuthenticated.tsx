import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/providers/auth/useAuth";
import AuthPage from "@/pages/auth/ui/AuthPage";

const RedirectIfAuthenticated = () => {
  const auth = useAuth();

  if (!auth) {
    throw new Error(
      "Auth context is unavailable. Wrap routes with <AuthProvider>.",
    );
  }

  if (auth.user) {
    return <Navigate to="/" replace />;
  }

  return <AuthPage />;
};

export default RedirectIfAuthenticated;
