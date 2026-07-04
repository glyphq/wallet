import { useState, useCallback, useEffect } from "react";
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

export default function NotificationWindow({ data }: { data: NotifData }) {
  const [exiting, setExiting] = useState(false);

  const close = useCallback(() => {
    setExiting(true);
    setTimeout(() => { try { window.close(); } catch { /* */ } }, 200);
  }, []);

  useEffect(() => {
    if (data.duration > 0) {
      const t = setTimeout(close, data.duration);
      return () => clearTimeout(t);
    }
  }, [data, close]);

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
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 12, right: 12, height: 2, borderRadius: 1,
          background: `linear-gradient(90deg, ${config.color}00, ${config.color}, ${config.color}00)`,
          opacity: 0.6,
        }} />
        <div style={{
          flexShrink: 0, width: 34, height: 34, borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${config.color}18`,
        }}>
          <Icon size={18} color={config.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.3 }}>{data.title}</div>
          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, marginTop: 2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{data.body}</div>
        </div>
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
