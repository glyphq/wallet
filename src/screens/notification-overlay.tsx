import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";
import glyphOnLight from "@/assets/brand/glyph-on-light.png";
import { getThemeVars, THEME_VARS } from "@/lib/appearance";
import { explorerAccountUrl, explorerTransactionUrl } from "@/lib/explorer";
import { trimNotificationCards, upsertNotificationCard } from "@/lib/notification-window-state";

interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  kind: string;
  identity: string | null;
  txHash: string | null;
  durationSecs: number;
  maxVisible: number;
  theme: "dark" | "light";
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  soundUrl?: string | null;
  soundVolume?: number;
  progress?: number;
  resolved?: boolean;
  etaSeconds?: number | null;
}

interface NotificationProgressPayload {
  hash: string;
  progress: number;
  resolved?: boolean;
  etaSeconds?: number | null;
}

function targetUrl(notification: NotificationPayload): string | null {
  if (notification.txHash) return explorerTransactionUrl(notification.txHash);
  if (notification.identity) return explorerAccountUrl(notification.identity);
  return null;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "Confirming";
  if (seconds < 60) return `ETA ~${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `ETA ~${minutes}m${rest ? ` ${rest}s` : ""}`;
}

const NOTIFICATION_STATE_COLORS: Record<string, string> = {
  sent: "var(--color-status-warning)",
  received: "var(--color-accent)",
  confirmed: "var(--color-status-success)",
  failed: "var(--color-status-error)",
  expired: "var(--color-status-error)",
  deep_link: "var(--color-status-info)",
  price_alert: "var(--color-status-info)",
  system: "var(--color-text-tertiary)",
};

function NotificationCard({
  notification,
  onDismiss,
}: {
  notification: NotificationPayload;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(notification.etaSeconds ?? null);
  const [etaStartSeconds, setEtaStartSeconds] = useState<number | null>(notification.etaSeconds ?? null);
  const remainingRef = useRef(notification.durationSecs * 1000);
  const contentKey = `${notification.title}\n${notification.body}\n${notification.kind}`;
  const previousContentRef = useRef(contentKey);
  const url = targetUrl(notification);
  const stateColor = NOTIFICATION_STATE_COLORS[notification.kind] ?? "var(--color-text-tertiary)";
  const progress = Math.min(100, Math.max(0, notification.progress ?? 100));
  const activeTransaction = notification.kind === "sent" && notification.txHash !== null && !notification.resolved;

  useEffect(() => {
    const next = notification.etaSeconds ?? null;
    if (next != null) {
      setEtaStartSeconds((previous) => previous ?? next);
    }
    setEtaSeconds((previous) => {
      if (next == null) return previous;
      return previous == null ? next : Math.min(previous, next);
    });
  }, [notification.etaSeconds]);

  const hasEta = activeTransaction && etaSeconds != null && etaSeconds > 0;
  useEffect(() => {
    if (!hasEta) return;
    const timer = window.setInterval(() => {
      setEtaSeconds((previous) => (previous == null ? null : Math.max(0, previous - 1)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasEta]);

  const etaLabel = activeTransaction && etaSeconds != null ? formatEta(etaSeconds) : null;
  let displayedProgress = progress;
  if (activeTransaction) {
    const elapsedRatio = etaStartSeconds != null && etaStartSeconds > 0 && etaSeconds != null
      ? Math.min(1, Math.max(0, (etaStartSeconds - etaSeconds) / etaStartSeconds))
      : 0;
    displayedProgress = Math.min(60, Math.max(30, progress, 30 + elapsedRatio * 30));
    if (etaSeconds != null && etaSeconds <= 0) displayedProgress = 60;
  }

  useEffect(() => {
    if (previousContentRef.current !== contentKey) {
      previousContentRef.current = contentKey;
      remainingRef.current = notification.durationSecs * 1000;
    }
    if (activeTransaction || paused || remainingRef.current <= 0) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(notification.id), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [activeTransaction, contentKey, notification.durationSecs, notification.id, onDismiss, paused]);

  function openTarget() {
    if (!url) return;
    void openUrl(url).catch(() => {});
    onDismiss(notification.id);
  }

  return (
    <div
      role={url ? "button" : "status"}
      tabIndex={url ? 0 : undefined}
      onClick={openTarget}
      onKeyDown={(event) => {
        if (url && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          openTarget();
        }
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="notification-card corner-frame"
      data-clickable={url ? "true" : "false"}
      style={{
        position: "relative",
        height: 120,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: 14,
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-card)",
        background: "var(--color-bg-surface)",
        boxShadow: "var(--shadow-overlay)",
        color: "var(--color-text-primary)",
        cursor: url ? "pointer" : "default",
        textAlign: "left",
        overflow: "hidden",
        "--corner-color": "var(--color-border-default)",
      } as CSSProperties}
    >
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ scaleX: displayedProgress / 100 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: stateColor,
          transformOrigin: "left",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        <img
          src={notification.theme === "light" ? glyphOnLight : glyphOnDark}
          width={24}
          height={24}
          alt=""
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-body)",
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {notification.title}
        </div>
        <div
          style={{
            marginTop: 5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-compact)",
            lineHeight: 1.38,
            color: "var(--color-text-secondary)",
            overflowWrap: "anywhere",
          }}
        >
          {notification.body}
        </div>
      </div>
      <button
        type="button"
        className="glyph-icon-btn"
        aria-label="Dismiss notification"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss(notification.id);
        }}
        style={{
          width: 26,
          height: 26,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          borderRadius: "var(--radius-sharp)",
          background: "transparent",
          color: "var(--color-text-tertiary)",
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          fontSize: 17,
          flexShrink: 0,
          marginTop: -1,
        }}
      >
        ×
      </button>
      {etaLabel ? (
        <span
          title="Estimated time to the transaction target tick"
          style={{
            position: "absolute",
            right: 14,
            bottom: 8,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            fontWeight: 500,
            letterSpacing: "0.03em",
            fontVariantNumeric: "tabular-nums",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "var(--radius-sharp)",
            background: "var(--color-bg-inset)",
            padding: "2px 6px",
            whiteSpace: "nowrap",
            zIndex: 3,
          }}
        >
          {etaLabel}
        </span>
      ) : null}
    </div>
  );
}

/** Separate always-on-top window that renders desktop notification cards. */
export function NotificationOverlay() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [position, setPosition] = useState<NotificationPayload["position"]>("bottom-right");
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const terminalSoundedRef = useRef<Set<string>>(new Set());

  const playSound = useCallback((notification: NotificationPayload) => {
    if (!notification.soundUrl || typeof Audio === "undefined") return;
    try {
      activeAudioRef.current?.pause();
      const audio = new Audio(notification.soundUrl);
      audio.volume = Math.min(1, Math.max(0, notification.soundVolume ?? 0.65));
      activeAudioRef.current = audio;
      void audio.play().catch(() => {});
    } catch {
      // Audio is best effort; the card must still render if output is unavailable.
    }
  }, []);

  useEffect(() => {
    const root = document.getElementById("root");
    for (const element of [document.documentElement, document.body, root]) {
      if (element) element.style.background = "transparent";
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unlisten: UnlistenFn | null = null;
    let unlistenProgress: UnlistenFn | null = null;
    const push = (notification: NotificationPayload, withSound: boolean) => {
      if (!active) return;
      if (withSound) {
        const terminal = notification.txHash !== null &&
          ["confirmed", "failed", "expired", "received"].includes(notification.kind);
        const alreadySounded = terminal && terminalSoundedRef.current.has(notification.txHash!);
        if (terminal) terminalSoundedRef.current.add(notification.txHash!);
        if (!alreadySounded) playSound(notification);
      }
      setPosition(notification.position);
      for (const name of THEME_VARS) document.documentElement.style.removeProperty(name);
      const vars = getThemeVars(notification.theme);
      for (const [name, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(name, value);
      }
      setNotifications((previous) =>
        trimNotificationCards(
          upsertNotificationCard(previous, notification),
          notification.maxVisible,
        ),
      );
    };

    void (async () => {
      const stopListening = await listen<NotificationPayload>("glyph:notification", (event) => {
        push(event.payload, true);
      });
      if (!active) {
        stopListening();
        return;
      }
      unlisten = stopListening;

      const stopProgress = await listen<NotificationProgressPayload>("glyph:notification-progress", (event) => {
        if (!active) return;
        const progress = Math.min(100, Math.max(0, event.payload.progress));
        setNotifications((previous) =>
          previous.map((item) =>
            item.txHash === event.payload.hash
              ? {
                  ...item,
                  progress: Math.max(item.progress ?? 0, progress),
                  resolved: item.resolved || event.payload.resolved,
                  etaSeconds: event.payload.etaSeconds === undefined
                    ? item.etaSeconds
                    : event.payload.etaSeconds,
                }
              : item,
          ),
        );
      });
      if (!active) {
        stopProgress();
        return;
      }
      unlistenProgress = stopProgress;

      const pending = await invoke<NotificationPayload[]>("get_pending_notifications");
      for (const notification of pending) push(notification, false);
    })();

    return () => {
      active = false;
      unlisten?.();
      unlistenProgress?.();
      activeAudioRef.current?.pause();
    };
  }, [playSound]);

  const dismiss = useCallback((id: string) => {
    setNotifications((previous) => previous.filter((item) => item.id !== id));
    void invoke("dismiss_notification", { id });
  }, []);

  const previousCount = useRef(0);
  useEffect(() => {
    const shrinking = notifications.length < previousCount.current;
    previousCount.current = notifications.length;
    const timer = window.setTimeout(() => {
      void invoke("layout_notification_overlay", { count: notifications.length });
    }, shrinking ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [notifications.length]);

  const ordered = position.startsWith("top") ? [...notifications].reverse() : notifications;
  const fromBottom = position.startsWith("bottom");
  const fromLeft = position.endsWith("left");
  const fromRight = position.endsWith("right");

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: position.startsWith("bottom") ? "flex-end" : "flex-start",
        gap: 8,
        padding: 10,
        overflow: "hidden",
      }}
    >
      <AnimatePresence initial={false}>
        {ordered.map((notification) => (
          <motion.div
            key={notification.id}
            layout
            initial={{
              opacity: 0,
              x: fromLeft ? -20 : fromRight ? 20 : 0,
              y: fromBottom ? 12 : -12,
              scale: 0.96,
            }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: fromLeft ? -12 : fromRight ? 12 : 0,
              y: fromBottom ? 8 : -8,
              scale: 0.97,
            }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ flexShrink: 0 }}
          >
            <NotificationCard notification={notification} onDismiss={dismiss} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
