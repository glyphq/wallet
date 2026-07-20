import { useRef, useEffect, useLayoutEffect, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useHeaderSlot } from "./header-slot";

export interface AppShellProps {
  children: ReactNode;
  statusBar?: ReactNode;
  contentStyle?: CSSProperties;
  fullBleed?: boolean;
}

export function AppShell({ children, statusBar, contentStyle, fullBleed }: AppShellProps) {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const { setHeader } = useHeaderSlot();

  // Push statusBar content to the static header slot in AnimatedLayout
  useEffect(() => {
    setHeader(statusBar ?? null);
    return () => setHeader(null);
  }, [statusBar, setHeader]);

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
    <main
      ref={mainRef}
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        overflowY: "auto",
        padding: fullBleed ? 0 : "var(--screen-padding)",
        background: "var(--color-bg-base)",
        ...contentStyle,
        paddingBottom: fullBleed ? 0 : "var(--screen-padding)",
      }}
    >
      {children}
    </main>
  );
}
