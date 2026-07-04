import { useEffect, useCallback, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, ArrowUp, ShieldCheck, DangerCircle, ClockCircle, BoltCircle, CloseCircle, LinkCircle } from "@solar-icons/react";
import { useToasts, dismissToast, type Toast, type ToastKind } from "@/store/toast";

// ── Kind config ───────────────────────────────────────────────────────────────

const KIND_CONFIG: Record<ToastKind, { color: string; icon: typeof CheckCircle }> = {
  received:    { color: "#4ade80", icon: CheckCircle },
  sent:        { color: "#60a5fa", icon: ArrowUp },
  confirmed:   { color: "#ccfcfb", icon: ShieldCheck },
  failed:      { color: "#f87171", icon: DangerCircle },
  expired:     { color: "#fbbf24", icon: ClockCircle },
  deep_link:   { color: "#60a5fa", icon: LinkCircle },
  price_alert: { color: "#c084fc", icon: BoltCircle },
};

// ── Single toast ──────────────────────────────────────────────────────────────

function ToastCard({ toast }: { toast: Toast }) {
  const config = KIND_CONFIG[toast.kind];
  const Icon = config.icon;

  const onDismiss = useCallback(() => dismissToast(toast.id), [toast.id]);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const root: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    width: 340,
    padding: "12px 14px 12px 12px",
    borderRadius: 14,
    background: "rgba(22, 22, 24, 0.92)",
    backdropFilter: "blur(24px) saturate(1.4)",
    WebkitBackdropFilter: "blur(24px) saturate(1.4)",
    border: `1px solid rgba(255,255,255,0.06)`,
    boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)`,
    overflow: "hidden",
    cursor: "default",
    userSelect: "none",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={root}
      onClick={onDismiss}
    >
      {/* Accent left bar */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 8,
        bottom: 8,
        width: 3,
        borderRadius: 2,
        background: config.color,
        opacity: 0.8,
      }} />

      {/* Icon */}
      <div style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${config.color}14`,
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
          {toast.title}
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
          {toast.body}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          padding: 2,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.3,
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.3"; }}
      >
        <CloseCircle size={16} color="rgba(255,255,255,0.6)" />
      </button>

      {/* Auto-dismiss progress bar */}
      {toast.duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: toast.duration / 1000, ease: "linear" }}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: config.color,
            opacity: 0.4,
            transformOrigin: "left",
          }}
        />
      )}
    </motion.div>
  );
}

// ── Toast container ───────────────────────────────────────────────────────────

export function ToastContainer() {
  const toasts = useToasts();

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 80,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastCard toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
