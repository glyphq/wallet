import { useEffect, useState, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { CheckCircle, ArrowUp, ShieldCheck, DangerCircle, ClockCircle, BoltCircle, LinkCircle, CloseCircle } from "@solar-icons/react";

type NotifKind = "received" | "sent" | "confirmed" | "failed" | "expired" | "deep_link" | "price_alert";

interface NotifData {
  kind: NotifKind;
  title: string;
  body: string;
  duration: number;
}

const KIND_CONFIG: Record<NotifKind, { color: string; icon: typeof CheckCircle }> = {
  received:    { color: "#4ade80", icon: CheckCircle },
  sent:        { color: "#60a5fa", icon: ArrowUp },
  confirmed:   { color: "#ccfcfb", icon: ShieldCheck },
  failed:      { color: "#f87171", icon: DangerCircle },
  expired:     { color: "#fbbf24", icon: ClockCircle },
  deep_link:   { color: "#60a5fa", icon: LinkCircle },
  price_alert: { color: "#c084fc", icon: BoltCircle },
};

function parseParams(): NotifData | null {
  try {
    // App uses createHashRouter — query params live in the hash fragment
    // e.g. index.html#/notification?data=eyJraW5k...
    const hash = window.location.hash;
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return null;
    const params = new URLSearchParams(hash.slice(qIndex));
    const raw = params.get("data");
    if (!raw) return null;
    // data is URL-safe base64-encoded JSON
    const json = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as NotifData;
  } catch {
    return null;
  }
}

export default function NotificationWindow() {
  const [data, setData] = useState<NotifData | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setData(parseParams());
  }, []);

  const close = useCallback(async () => {
    setExiting(true);
    setTimeout(async () => {
      try {
        const win = getCurrentWebviewWindow();
        await win.close();
      } catch { /* already closed */ }
    }, 200);
  }, []);

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(close, data.duration);
    return () => clearTimeout(timer);
  }, [data, close]);

  if (!data) return null;

  const config = KIND_CONFIG[data.kind] ?? KIND_CONFIG.received;
  const Icon = config.icon;

  return (
    <div
      onClick={close}
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "stretch",
        background: "transparent",
        cursor: "pointer",
        userSelect: "none",
        fontFamily: "Geist, -apple-system, sans-serif",
        overflow: "hidden",
        borderRadius: 14,
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateX(40px)" : "translateX(0)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}
    >
      {/* Card */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "12px 14px 12px 14px",
          borderRadius: 14,
          background: "rgba(22, 22, 24, 0.95)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Accent top bar */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 12,
          right: 12,
          height: 2,
          borderRadius: 1,
          background: `linear-gradient(90deg, ${config.color}00, ${config.color}, ${config.color}00)`,
          opacity: 0.6,
        }} />

        {/* Icon */}
        <div style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${config.color}18`,
        }}>
          <Icon size={18} color={config.color} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}>
            {data.title}
          </div>
          <div style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.4,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {data.body}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); close(); }}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            padding: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.3,
            marginTop: -2,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.3"; }}
        >
          <CloseCircle size={16} color="rgba(255,255,255,0.6)" />
        </button>

        {/* Progress bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 2,
            background: config.color,
            opacity: 0.35,
            transformOrigin: "left",
            animation: `shrink ${data.duration}ms linear forwards`,
          }}
        />
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}
