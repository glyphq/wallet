import { useLayoutEffect, useState, useCallback, useRef } from "react";
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

// Parse base64 JSON data from the URL hash.
// MUST run in useLayoutEffect (before paint) because the router will strip the hash params.
function readNotifData(): NotifData | null {
  try {
    // window.location.href has the full hash before the router processes it
    const href = window.location.href;
    const match = href.match(/[&#?]data=([^&]+)/);
    if (!match) return null;
    const b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    console.log("[notif] parsed data:", json);
    return JSON.parse(json) as NotifData;
  } catch (e) {
    console.log("[notif] parse failed:", e);
    return null;
  }
}

export default function NotificationWindow() {
  const [data, setData] = useState<NotifData | null>(null);
  const [exiting, setExiting] = useState(false);
  const dataRef = useRef<NotifData | null>(null);

  // Read data BEFORE the router can strip the hash
  useLayoutEffect(() => {
    const d = readNotifData();
    dataRef.current = d;
    setData(d);
    console.log("[notif] useLayoutEffect data:", d);
    console.log("[notif] location.href:", window.location.href);
    console.log("[notif] location.hash:", window.location.hash);
  }, []);

  const close = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      try { window.close(); } catch { /* ignore */ }
    }, 200);
  }, []);

  // Auto-dismiss
  useLayoutEffect(() => {
    if (!data || data.duration <= 0) return;
    const t = setTimeout(close, data.duration);
    return () => clearTimeout(t);
  }, [data, close]);

  if (!data) {
    // Fallback: show debug info so we can see what's happening
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0F0F0F", color: "#f87171", fontFamily: "monospace", fontSize: 11, padding: 16,
      }}>
        <div>
          <div>No notification data</div>
          <div style={{ color: "rgba(255,255,255,0.4)", marginTop: 8, wordBreak: "break-all" }}>
            href: {typeof window !== "undefined" ? window.location.href : "N/A"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", wordBreak: "break-all" }}>
            hash: {typeof window !== "undefined" ? window.location.hash : "N/A"}
          </div>
        </div>
      </div>
    );
  }

  const config = KIND_CONFIG[data.kind] ?? KIND_CONFIG.received;
  const Icon = config.icon;

  return (
    <div
      onClick={close}
      style={{
        height: "100vh", width: "100vw",
        display: "flex", alignItems: "stretch",
        background: "transparent", cursor: "pointer", userSelect: "none",
        fontFamily: "Geist, -apple-system, sans-serif", overflow: "hidden", borderRadius: 14,
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateX(40px)" : "translateX(0)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}
    >
      <div style={{
        flex: 1, display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 14px 12px 12px", borderRadius: 14,
        background: "rgba(22, 22, 24, 0.95)",
        backdropFilter: "blur(24px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Accent top bar */}
        <div style={{
          position: "absolute", top: 0, left: 12, right: 12, height: 2, borderRadius: 1,
          background: `linear-gradient(90deg, ${config.color}00, ${config.color}, ${config.color}00)`,
          opacity: 0.6,
        }} />

        {/* Icon */}
        <div style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${config.color}18`,
        }}>
          <Icon size={18} color={config.color} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>
            {data.title}
          </div>
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {data.body}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); close(); }}
          style={{
            flexShrink: 0, background: "none", border: "none", padding: 4,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", opacity: 0.3,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.3"; }}
        >
          <CloseCircle size={16} color="rgba(255,255,255,0.6)" />
        </button>

        {/* Progress bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, width: "100%", height: 2,
          background: config.color, opacity: 0.35, transformOrigin: "left",
          animation: `shrink ${data.duration}ms linear forwards`,
        }} />
      </div>

      <style>{`@keyframes shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
    </div>
  );
}
