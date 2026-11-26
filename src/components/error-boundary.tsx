import { Component, useState, type ErrorInfo, type ReactNode } from "react";
import { useNavigate, useRouteError } from "react-router";
import { Copy01Icon, RefreshIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { FullPage } from "@/layouts/full-page";
import { PageBanner, PageFrame } from "@/components/page-header";
import { copyToClipboard } from "@/lib/clipboard";
import { recordRuntimeIssue } from "@/lib/runtime-issues";

const SHOW_ERROR_DEBUG_DETAILS =
  import.meta.env.DEV ||
  (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname));

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Unknown render failure");
}

function buildReport(error: Error, componentStack: string): string {
  return [
    "Glyph render error",
    `Time: ${new Date().toISOString()}`,
    `Message: ${error.message}`,
    `URL: ${typeof window !== "undefined" ? window.location.href : "unknown"}`,
    `User agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
    "",
    "Component stack:",
    componentStack.trim() || "unavailable",
    "",
    "JS stack:",
    error.stack || "unavailable",
  ].join("\n");
}

function ErrorFallback({
  error,
  componentStack,
  onRetry,
}: {
  error: Error;
  componentStack: string;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyReport() {
    const copiedOK = await copyToClipboard(buildReport(error, componentStack));
    if (!copiedOK) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <FullPage centered={false} style={{ padding: 0 }}>
      <PageBanner
        title="Something went wrong."
        description="Glyph stopped this view before it could continue."
      />
      <PageFrame
        actions={(
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {onRetry ? (
              <Button size="md" style={{ width: "100%" }} onClick={onRetry}>
                <RefreshIcon size={16} strokeWidth={1.5} aria-hidden="true" />
                Try again
              </Button>
            ) : null}
            <Button variant={onRetry ? "secondary" : "primary"} size="md" style={{ width: "100%" }} onClick={() => window.location.reload()}>
              <RefreshIcon size={16} strokeWidth={1.5} aria-hidden="true" />
              Reload app
            </Button>
            <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => void copyReport()}>
              <Copy01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              {copied ? "Report copied" : "Copy report"}
            </Button>
          </div>
        )}
      >
        <div
          role="alert"
          style={{
            width: "100%",
            maxWidth: 420,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <span aria-live="polite" className="sr-only">{copied ? "Error report copied to clipboard" : ""}</span>

          {SHOW_ERROR_DEBUG_DETAILS ? (
            <section className="error-details" aria-label="Diagnostic details">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Diagnostic details
              </span>
              <pre>
                {error.message || "Unknown render failure"}
                {"\n\n"}
                {componentStack.trim() ? `Component stack\n${componentStack.trim()}` : "Component stack unavailable"}
                {error.stack ? `\n\nJS stack\n${error.stack}` : ""}
              </pre>
            </section>
          ) : null}
        </div>
      </PageFrame>
    </FullPage>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[glyph] uncaught render error:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? "" });
    recordRuntimeIssue({
      source: "renderer",
      title: "React render error",
      detail: `${error.message}${info.componentStack ? ` ${info.componentStack}` : ""}`,
    });
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          onRetry={() => this.setState({ error: null, componentStack: "" })}
        />
      );
    }
    return this.props.children;
  }
}

/** Router-level fallback for failures above the route element boundary. */
export function RouteErrorBoundary() {
  const routeError = useRouteError();
  const navigate = useNavigate();
  return (
    <ErrorFallback
      error={normalizeError(routeError)}
      componentStack=""
      onRetry={() => navigate("/dashboard", { replace: true })}
    />
  );
}
