import { useMemo } from "react";
import { useNavigate } from "react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";
import glyphOnLight from "@/assets/brand/glyph-on-light.png";
import { LockKeyholeIcon } from "@/lib/icons";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

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
      className="titlebar-action"
      data-danger={danger ? "true" : undefined}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const navigate = useNavigate();
  // Vite previews, component tests, and browser-based accessibility checks do
  // not have Tauri's window bridge. Keep the app shell usable in those
  // environments instead of throwing while the title bar mounts.
  const win = useMemo(
    () => (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? getCurrentWindow() : null),
    [],
  );
  const themeMode = usePersistedStore((state) => state.settings.themeMode);
  const isLocked = useSessionStore((state) => state.isLocked);
  const lock = useSessionStore((state) => state.lock);
  const logo = themeMode === "light" ? glyphOnLight : glyphOnDark;

  return (
    <div
      data-tauri-drag-region
      style={{
        height: "var(--height-titlebar)",
        flexShrink: 0,
        background: "var(--color-bg-header)",
        borderBottom: "1px solid var(--color-border-subtle)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        padding: "0 0 0 var(--space-3)",
        userSelect: "none",
      }}
    >
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
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
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "var(--color-text-primary)",
          }}
        >
          Glyph Wallet
        </span>
      </div>

      {win ? (
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, height: "100%" }}>
          {!isLocked ? (
            <WinBtn
              onClick={() => {
                lock();
                navigate("/lock", { replace: true });
              }}
              label="Lock wallet"
            >
              <LockKeyholeIcon size={18} />
            </WinBtn>
          ) : null}

          <WinBtn
            onClick={() => void win.minimize()}
            label="Minimize"
          >
            <svg width="13" height="3" viewBox="0 0 13 3" aria-hidden="true">
              <line x1="0" y1="1.5" x2="13" y2="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </WinBtn>

          <WinBtn onClick={() => void win.close()} label="Close" danger>
            <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
              <line x1="1.5" y1="1.5" x2="11.5" y2="11.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11.5" y1="1.5" x2="1.5" y2="11.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </WinBtn>
        </div>
      ) : null}
    </div>
  );
}
