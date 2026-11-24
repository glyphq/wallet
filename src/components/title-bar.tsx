import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";
import glyphOnLight from "@/assets/brand/glyph-on-light.png";
import { Moon02Icon, Sun01Icon } from "@/lib/icons";
import { usePersistedStore } from "@/store/persisted";

function WinBtn({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="titlebar-action corner-frame"
      data-danger={danger ? "true" : undefined}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function useRouteHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return hash;
}

export function TitleBar() {
  const routeHash = useRouteHash();
  // Vite previews, component tests, and browser-based accessibility checks do
  // not have Tauri's window bridge. Keep the app shell usable in those
  // environments instead of throwing while the title bar mounts.
  const win = useMemo(
    () => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null),
    [],
  );
  const themeMode = usePersistedStore((state) => state.settings.themeMode);
  const updateSettings = usePersistedStore((state) => state.updateSettings);
  const logo = themeMode === "light" ? glyphOnLight : glyphOnDark;

  // The splash owns the whole window while it checks updates and hydrates.
  if (routeHash === "" || routeHash === "#/" || routeHash === "#") return null;
  return (
    <div
      data-tauri-drag-region
      style={{
        height: "var(--height-titlebar)",
        flexShrink: 0,
        background: "var(--color-bg-header)",
        borderBottom: "1px solid var(--color-border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-3)",
        userSelect: "none",
      }}
    >
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          pointerEvents: "none",
        }}
      >
        <img
          src={logo}
          width={26}
          height={26}
          alt=""
          aria-hidden="true"
          data-tauri-drag-region
          style={{ flexShrink: 0 }}
        />
        <span
          data-tauri-drag-region
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--color-text-primary)",
          }}
        >
          Glyph Wallet
        </span>
      </div>

      {win ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <WinBtn
            onClick={() => void win.minimize()}
            label="Minimize"
          >
            <svg width="10" height="2" viewBox="0 0 10 2" aria-hidden="true">
              <line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </WinBtn>

          <WinBtn
            onClick={() => updateSettings({ themeMode: themeMode === "dark" ? "light" : "dark" })}
            label={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {themeMode === "dark" ? <Sun01Icon size={14} /> : <Moon02Icon size={14} />}
          </WinBtn>

          <WinBtn onClick={() => void win.close()} label="Close" danger>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </WinBtn>
        </div>
      ) : null}
    </div>
  );
}
