import { useEffect, useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import * as Sentry from "@sentry/react";
import { ArrowRight, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/entities/auth";
import type { AuthCredentials } from "@/entities/auth";
import { LoginForm, SignupForm } from "@/features/auth";

type Mode = "login" | "register";

const DEMO_PASSWORD = "DemoPass123!";

const DEMO_ACCOUNTS = [
  {
    key: "tid",
    email: "mock-user-0001@example.com",
    icon: Sparkles,
    tone: "from-sky-500 via-cyan-500 to-emerald-400",
  },
  {
    key: "dataset_a",
    email: "mock-user-0001@example.com",
    icon: Users,
    tone: "from-amber-400 via-orange-400 to-pink-400",
  },
  {
    key: "dataset_b",
    email: "mock-user-0002@example.com",
    icon: Users,
    tone: "from-violet-400 via-fuchsia-400 to-rose-400",
  },
  {
    key: "admin",
    email: "admin@example.com",
    icon: ShieldCheck,
    tone: "from-slate-600 via-slate-700 to-slate-900",
  },
] as const;

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

  const authenticate = async (credentials: AuthCredentials) => {
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
      throw error;
    }
  };

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const credentials: AuthCredentials = { email: email.trim(), password };
    await authenticate(credentials);
  };

  const quickLogin = async (credentials: AuthCredentials) => {
    if (isLoading) {
      return;
    }
    setEmail(credentials.email);
    setPassword(credentials.password);
    setMode("login");
    try {
      await authenticate(credentials);
    } catch {
      return;
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
        {mode === "login" ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
            className="mt-5 overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-500">
                  {t("auth.demo_accounts_eyebrow")}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  {t("auth.demo_accounts_title")}
                </h3>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  {t("auth.demo_accounts_description")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void quickLogin({
                  email: "mock-user-0001@example.com",
                  password: DEMO_PASSWORD,
                })
              }
              disabled={isLoading}
              className="group mt-4 flex w-full items-center justify-between overflow-hidden rounded-[24px] bg-slate-950 px-5 py-4 text-left text-white shadow-[0_20px_50px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_25px_60px_rgba(15,23,42,0.4)] disabled:opacity-60"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
                  {t("auth.tid_mock_badge")}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {t("auth.login_with_tid_mock")}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {t("auth.tid_mock_description")}
                </p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 transition group-hover:bg-white/15">
                <ArrowRight className="size-5" />
              </span>
            </button>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {DEMO_ACCOUNTS.filter((account) => account.key !== "tid").map((account) => {
                const Icon = account.icon;
                return (
                  <button
                    key={account.key}
                    type="button"
                    onClick={() =>
                      void quickLogin({
                        email: account.email,
                        password: DEMO_PASSWORD,
                      })
                    }
                    disabled={isLoading}
                    className="group relative overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] disabled:opacity-60"
                  >
                    <div
                      className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${account.tone}`}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {t(`auth.demo_account_${account.key}_title`)}
                        </p>
                        <p className="text-xs leading-5 text-slate-500">
                          {t(`auth.demo_account_${account.key}_description`)}
                        </p>
                        <p className="pt-1 text-xs font-medium text-slate-400">
                          {account.email}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 p-2 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
                        <Icon className="size-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.section>
        ) : null}
      </motion.div>
    </div>
  );
}
