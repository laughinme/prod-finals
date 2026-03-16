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
    <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
