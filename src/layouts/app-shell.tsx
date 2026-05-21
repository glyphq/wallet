import { useRef, useEffect, useLayoutEffect, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useLockCountdown } from "@/hooks/use-lock-countdown";

export interface AppShellProps {
  children: ReactNode;
  statusBar?: ReactNode;
  bottomNav?: ReactNode;
  contentStyle?: CSSProperties;
}

export function AppShell({ children, statusBar, bottomNav, contentStyle }: AppShellProps) {
  const countdown = useLockCountdown();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${location.key}`);
    if (mainRef.current && saved) mainRef.current.scrollTop = Number(saved);
  }, [location.key]);

  useEffect(() => {
    const el = mainRef.current;
    const key = location.key;
    return () => { if (el) sessionStorage.setItem(`scroll:${key}`, String(el.scrollTop)); };
  }, [location.key]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg-base)",
        overflow: "hidden",
      }}
    >
      {statusBar && (
        <header
          style={{
            flexShrink: 0,
            height: 44,
            display: "flex",
            alignItems: "center",
            padding: "0 var(--space-4)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          {statusBar}
        </header>
      )}

      {countdown !== null && (
        <div
          aria-live="polite"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-1) var(--space-4)",
            background: "var(--color-bg-elevated)",
            borderBottom: "1px solid var(--color-border-subtle)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>
            [LOCKING IN {countdown}s]
          </span>
        </div>
      )}

      <main
        ref={mainRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-4)",
          ...contentStyle,
        }}
      >
        {children}
      </main>

      {bottomNav && (
        <nav
          style={{
            flexShrink: 0,
            height: 56,
            display: "flex",
            borderTop: "1px solid var(--color-border-subtle)",
          }}
        >
          {bottomNav}
        </nav>
      )}
    </div>
  );
}
