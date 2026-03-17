import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "@/entities/auth";
import "./styles/index.css";
import "@/shared/lib/i18n";
import * as Sentry from "@sentry/react";

import i18n from "@/shared/lib/i18n";

const queryClient = new QueryClient();
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(i18n.t("common.configuration_error"));
}

Sentry.init({
  dsn: "https://36c479372735efd0da21508044214ce5@o4511044892033024.ingest.de.sentry.io/4511044893868112",
  sendDefaultPii: true,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/team-26-test-vm-6b7c17.pages.prodcontest.ru\/api/,
  ],
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

createRoot(rootElement, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error("Uncaught error", error, errorInfo);
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-8 text-center">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-destructive/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-destructive"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Произошла непредвиденная ошибка
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Приложение столкнулось с проблемой. Попробуйте обновить страницу.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Обновить страницу
          </button>
        </div>
      }
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
