import { useState, type ReactNode } from "react";
import { useLockCountdown } from "@/hooks/use-lock-countdown";
import { StickyFooter } from "@/components/sticky-footer";
import { Clock01Icon } from "@/lib/icons";
import { RequestFooterProvider } from "./request-footer-context";
import { RequestStatusProvider, useRequestStatus } from "./request-status-context";

export function SheetLayout({ statusBar, children, expirySecsLeft }: { statusBar?: ReactNode; children: ReactNode; expirySecsLeft?: number | null }) {
  const countdown = useLockCountdown();
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null);
  return (
    <RequestStatusProvider expirySecsLeft={expirySecsLeft ?? null}>
    <RequestFooterProvider value={footerTarget}>
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg-base)" }}>
      {statusBar ? (
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
      ) : null}

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

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "var(--space-5) var(--screen-padding)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {children}
      </main>
      <div ref={setFooterTarget} />
    </div>
    </RequestFooterProvider>
    </RequestStatusProvider>
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

export function RequestExpiryNotch({ seconds }: { seconds: number }) {
  const warning = seconds <= 10;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "4px 10px",
        background: "var(--color-bg-nav)",
        borderLeft: "1px solid var(--color-border-subtle)",
        borderTop: "1px solid var(--color-border-subtle)",
        borderRight: "1px solid var(--color-border-subtle)",
        borderBottom: "none",
        borderRadius: "var(--radius-sharp) var(--radius-sharp) 0 0",
        color: warning ? "var(--color-status-error)" : "var(--color-status-warning)",
      }}
    >
      <Clock01Icon size={13} aria-hidden="true" />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Request expires in
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", fontVariantNumeric: "tabular-nums", color: warning ? "var(--color-status-error)" : "var(--color-status-warning)" }}>
        {seconds}s
      </span>
    </div>
  );
}

export function ActionFooter({ children }: { children: ReactNode }) {
  const { expirySecsLeft } = useRequestStatus();
  return (
    <StickyFooter notch={expirySecsLeft !== null ? <RequestExpiryNotch seconds={expirySecsLeft} /> : undefined}>
      {children}
    </StickyFooter>
  );
}
