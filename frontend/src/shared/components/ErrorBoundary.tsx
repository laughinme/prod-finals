import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  compact?: boolean;
  title?: string;
  description?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    if (this.props.compact) {
      return <CompactErrorFallback title={this.props.title} onRetry={this.handleRetry} />;
    }

    return (
      <FullErrorFallback
        title={this.props.title}
        description={this.props.description}
        onRetry={this.handleRetry}
      />
    );
  }
}

function CompactErrorFallback({ title, onRetry }: { title?: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {title || "Что-то пошло не так"}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
      >
        <RefreshCw className="size-3" />
        Попробовать снова
      </button>
    </div>
  );
}

function FullErrorFallback({
  title,
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-75 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-foreground">
          {title || "Произошла ошибка"}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description || "Попробуйте обновить страницу или повторить действие."}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
        >
          <RefreshCw className="size-4" />
          Попробовать снова
        </button>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Обновить страницу
        </button>
      </div>
    </div>
  );
}
