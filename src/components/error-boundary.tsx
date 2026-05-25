import { Component, type ErrorInfo, type ReactNode } from "react";
import { recordRuntimeIssue } from "@/lib/runtime-issues";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[sigil] uncaught render error:", error, info.componentStack);
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
          <button
            onClick={() => this.setState({ error: null })}
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
