import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";

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
  const win = useMemo(() => getCurrentWindow(), []);
  const [fullscreen, setFullscreen] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    win.isFullscreen().then(setFullscreen).catch(() => {});
    let unlisten: (() => void) | undefined;
    let active = true;
    win.listen("tauri://resize", async () => {
      try {
        setFullscreen(await win.isFullscreen());
      } catch {}
    }).then((u) => {
      if (!active) u();
      else unlisten = u;
    }).catch(() => {});
    return () => {
      active = false;
      unlisten?.();
    };
  }, [win]);

  if (fullscreen) return null;

  return (
    <div
      data-tauri-drag-region
      style={{
        height: "var(--height-titlebar)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--color-bg-header)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          padding: "0 var(--screen-padding)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-caption)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--color-text-primary)",
          }}
        >
          Glyph Wallet
        </span>
        {version && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-caption)",
              letterSpacing: "0.06em",
              color: "var(--color-text-tertiary)",
            }}
          >
            v{version}
          </span>
        )}
      </div>

      <div style={{ display: "flex", height: "100%" }}>
        <WinBtn onClick={() => win.minimize()} label="Minimize">
          <svg width="10" height="2" viewBox="0 0 10 2" aria-hidden="true">
            <line x1="0" y1="1" x2="10" y2="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </WinBtn>

        <WinBtn onClick={() => win.close()} label="Close" danger>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </WinBtn>
      </div>
    </div>
  );
}
