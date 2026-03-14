import "@/instrument";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./providers/auth/AuthContext";
import "./styles/index.css";
import "@/shared/lib/i18n";
import * as Sentry from "@sentry/react";

import i18n from "@/shared/lib/i18n";

const queryClient = new QueryClient();
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(i18n.t("common.configuration_error"));
}

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
