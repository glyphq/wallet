import { Component, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { useRouteError } from "react-router";
import { Alert01Icon, Copy01Icon, RefreshIcon } from "@/lib/icons";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { Button } from "@/components/button";
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
    <div
      role="alert"
      style={{
        position: "relative",
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        background: "var(--color-bg-base)",
      }}
    >
      <AsciiBackdrop style={{ position: "absolute", inset: 0 }} />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-4)",
          padding: "var(--space-6) var(--screen-padding)",
        }}
      >
        <div
          className="error-card corner-frame"
          style={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            padding: "var(--space-5)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-sharp)",
            background: "var(--color-bg-surface)",
            "--corner-size": "12px",
            "--corner-inset": "-4px",
            "--corner-color": "var(--color-status-error)",
          } as CSSProperties}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span
              aria-hidden="true"
              style={{
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                border: "1px solid var(--color-status-error)",
                borderRadius: "var(--radius-sharp)",
                background: "var(--color-status-error-soft)",
                color: "var(--color-status-error)",
              }}
            >
              <Alert01Icon size={18} strokeWidth={1.5} />
            </span>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-status-error)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Unhandled error
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Glyph / Recovery
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-title)",
                fontWeight: 400,
                lineHeight: "var(--leading-title)",
                letterSpacing: "0.04em",
                color: "var(--color-text-primary)",
              }}
            >
              Something went wrong.
            </h1>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body-compact)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-text-secondary)",
              }}
            >
              Glyph stopped this view before it could continue. Your wallet, accounts, and keys were not changed.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
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

          <span aria-live="polite" className="sr-only">{copied ? "Error report copied to clipboard" : ""}</span>

          {SHOW_ERROR_DEBUG_DETAILS ? (
            <details className="error-details">
              <summary>Diagnostic details</summary>
              <pre>
                {error.message || "Unknown render failure"}
                {"\n\n"}
                {componentStack.trim() ? `Component stack\n${componentStack.trim()}` : "Component stack unavailable"}
                {error.stack ? `\n\nJS stack\n${error.stack}` : ""}
              </pre>
            </details>
          ) : null}
        </div>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.06em",
            textAlign: "center",
          }}
        >
          The failure was recorded in Diagnostics.
        </span>
      </div>
    </div>
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
  return <ErrorFallback error={normalizeError(routeError)} componentStack="" />;
}
