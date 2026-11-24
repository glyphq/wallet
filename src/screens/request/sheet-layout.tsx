import type { ReactNode } from "react";
import { useLockCountdown } from "@/hooks/use-lock-countdown";

export function SheetLayout({ statusBar, children, expirySecsLeft }: { statusBar: ReactNode; children: ReactNode; expirySecsLeft?: number | null }) {
  const countdown = useLockCountdown();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg-base)" }}>
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          minHeight: 48,
          padding: "var(--space-3) var(--screen-padding)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        {statusBar}
      </header>

      {countdown !== null && (
        <div
          aria-live="polite"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-2) var(--screen-padding)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-warning)" }}>
            Locking in {countdown}s
          </span>
        </div>
      )}

      {expirySecsLeft !== null && expirySecsLeft !== undefined && (
        <div
          aria-live="polite"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-2) var(--screen-padding)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: expirySecsLeft <= 10 ? "var(--color-status-error)" : "var(--color-text-disabled)" }}>
            Request expires in {expirySecsLeft}s
          </span>
        </div>
      )}

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "var(--space-5) var(--screen-padding) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
        {children}
      </div>
    </div>
  );
}

export function StatusLine({ tone, children }: { tone: "muted" | "success" | "warning" | "error"; children: ReactNode }) {
  const color = tone === "success" ? "var(--color-status-success)" : tone === "warning" ? "var(--color-status-warning)" : tone === "error" ? "var(--color-status-error)" : "var(--color-text-disabled)";
  return (
    <div role={tone === "error" || tone === "warning" ? "alert" : "status"} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color }}>
      {children}
    </div>
  );
}

export function ActionFooter({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "auto", paddingTop: "var(--space-5)", borderTop: "1px solid var(--color-border-subtle)" }}>
      {children}
    </div>
  );
}
