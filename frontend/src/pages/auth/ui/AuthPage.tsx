import { useEffect, useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/app/providers/auth/useAuth";
import type { AuthCredentials } from "@/entities/auth/model";
import { LoginForm } from "@/features/auth/login-form";
import { SignupForm } from "@/features/auth/signup-form";

type Mode = "login" | "register";

export default function AuthPage(): ReactElement {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const auth = useAuth();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const getErrorMessage = (error: unknown): string => {
    if (typeof error === "string") {
      return error;
    }

    if (isAxiosError(error)) {
      if (error.response?.status === 401) {
        return t("auth.invalid_credentials");
      }

      const detail = error.response?.data?.detail;
      if (typeof detail === "string") {
        return detail;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return t("auth.generic_error");
  };

  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-slate-700">
        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <h2 className="text-2xl font-semibold text-red-500">
            {t("auth.auth_context_not_found")}
          </h2>
          <p className="mt-2">
            {t("auth.auth_provider_warning")}
          </p>
        </div>
      </div>
    );
  }

  const {
    login,
    register,
    isLoggingIn,
    loginError,
    isRegistering,
    registerError,
  } = auth;

  const isLoading = isLoggingIn || isRegistering;
  const error = mode === "login" ? loginError : registerError;
  const errorMessage = error ? getErrorMessage(error) : null;
  const canSubmit = Boolean(email.trim() && password.trim() && !isLoading);

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const credentials: AuthCredentials = { email: email.trim(), password };
    try {
      if (mode === "login") {
        await login(credentials);
      } else {
        await register(credentials);
      }
    } catch (error) {
      if (!isAxiosError(error) || (error.response?.status && error.response.status >= 500)) {
        Sentry.captureException(error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 text-foreground overflow-hidden">
      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={
          isVisible
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: 32, scale: 0.96 }
        }
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <LoginForm
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={submit}
                submitLabel={isLoading ? t("common.loading") : t("auth.login")}
                disabled={isLoading}
                submitDisabled={!canSubmit}
                errorMessage={errorMessage}
                onSwitchToSignup={() => setMode("register")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="signup"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <SignupForm
                email={email}
                password={password}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={submit}
                submitLabel={isLoading ? t("common.loading") : t("auth.create_account")}
                disabled={isLoading}
                submitDisabled={!canSubmit}
                errorMessage={errorMessage}
                onSwitchToLogin={() => setMode("login")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
