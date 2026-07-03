import { Component, type ErrorInfo, type ReactNode } from "react";
import { recordRuntimeIssue } from "@/lib/runtime-issues";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string;
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "var(--space-4)",
            padding: "var(--space-6)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-status-error)",
              letterSpacing: "0.05em",
              textAlign: "center",
            }}
          >
            [RENDER ERROR]
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-secondary)",
              letterSpacing: "0.04em",
              textAlign: "center",
              lineHeight: 1.6,
              wordBreak: "break-word",
              maxWidth: 320,
            }}
          >
            {this.state.error?.message || "Unknown render failure"}
          </span>
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "40vh",
              overflow: "auto",
              padding: "var(--space-4)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-sharp)",
              background: "var(--color-bg-surface)",
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-mono-sm)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {this.state.componentStack
                ? `[COMPONENT STACK]\n${this.state.componentStack.trim()}`
                : "[COMPONENT STACK UNAVAILABLE]"}
              {this.state.error?.stack ? `\n\n[JS STACK]\n${this.state.error.stack}` : ""}
            </pre>
          </div>
          <button
            onClick={() => this.setState({ error: null, componentStack: "" })}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-secondary)",
              letterSpacing: "0.05em",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
