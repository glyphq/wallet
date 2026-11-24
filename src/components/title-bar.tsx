import { useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";
import glyphOnLight from "@/assets/brand/glyph-on-light.png";
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 44,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered
          ? danger
            ? "var(--color-status-error)"
            : "var(--color-bg-elevated)"
          : "transparent",
        border: "none",
        borderRadius: 0,
        cursor: "pointer",
        color: hovered && danger ? "var(--color-text-inverse)" : hovered ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  // Vite previews, component tests, and browser-based accessibility checks do
  // not have Tauri's window bridge. Keep the app shell usable in those
  // environments instead of throwing while the title bar mounts.
  const win = useMemo(
    () => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null),
    [],
  );
  const themeMode = usePersistedStore((state) => state.settings.themeMode);
  const hideToTray = usePersistedStore((state) => state.settings.hideToTray);
  const logo = themeMode === "light" ? glyphOnLight : glyphOnDark;

  return (
    <div
      data-tauri-drag-region
      style={{
        height: "var(--height-titlebar)",
        flexShrink: 0,
        background: "var(--color-bg-header)",
        borderBottom: "1px solid var(--color-border-subtle)",
        userSelect: "none",
      }}
    >
      <div
        className="app-titlebar-frame corner-frame"
        data-tauri-drag-region
        style={{
          width: "100%",
          maxWidth: 1280,
          height: "100%",
          margin: "0 auto",
          padding: "0 var(--screen-padding)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderLeft: "1px solid var(--color-border-subtle)",
          borderRight: "1px solid var(--color-border-subtle)",
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
          <div style={{ display: "flex", height: "100%", marginRight: "calc(var(--screen-padding) * -1)" }}>
            <WinBtn
              onClick={() => { if (hideToTray) void win.hide(); else void win.minimize(); }}
              label={hideToTray ? "Hide to tray" : "Minimize"}
            >
              <svg width="10" height="2" viewBox="0 0 10 2" aria-hidden="true">
                <line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
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
    </div>
  );
}
