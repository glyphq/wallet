import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";
import glyphOnLight from "@/assets/brand/glyph-on-light.png";
import { getThemeVars, THEME_VARS } from "@/lib/appearance";
import { explorerAccountUrl, explorerTransactionUrl } from "@/lib/explorer";
import { upsertNotificationCard } from "@/lib/notification-window-state";

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
}

function targetUrl(notification: NotificationPayload): string | null {
  if (notification.txHash) return explorerTransactionUrl(notification.txHash);
  if (notification.identity) return explorerAccountUrl(notification.identity);
  return null;
}

function NotificationCard({
  notification,
  onDismiss,
}: {
  notification: NotificationPayload;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(notification.durationSecs * 1000);
  const contentKey = `${notification.title}\n${notification.body}\n${notification.kind}`;
  const previousContentRef = useRef(contentKey);
  const url = targetUrl(notification);

  useEffect(() => {
    if (previousContentRef.current !== contentKey) {
      previousContentRef.current = contentKey;
      remainingRef.current = notification.durationSecs * 1000;
    }
    if (paused || remainingRef.current <= 0) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(notification.id), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [contentKey, notification.durationSecs, notification.id, onDismiss, paused]);

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
        height: 100,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        border: "1px solid var(--color-border-strong)",
        borderRadius: "var(--radius-sharp)",
        background: "var(--color-bg-elevated)",
        boxShadow: "var(--shadow-elevated)",
        color: "var(--color-text-primary)",
        cursor: url ? "pointer" : "default",
        textAlign: "left",
        "--corner-color": "var(--color-border-strong)",
      } as CSSProperties}
    >
      <img
        src={notification.theme === "light" ? glyphOnLight : glyphOnDark}
        width={26}
        height={26}
        alt=""
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {notification.title}
        </div>
        <div
          style={{
            marginTop: 3,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            lineHeight: 1.35,
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
          width: 30,
          height: 30,
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
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

/** Separate always-on-top window that renders desktop notification cards. */
export function NotificationOverlay() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [position, setPosition] = useState<NotificationPayload["position"]>("bottom-right");
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

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
    const push = (notification: NotificationPayload, withSound: boolean) => {
      if (!active) return;
      if (withSound) playSound(notification);
      setPosition(notification.position);
      for (const name of THEME_VARS) document.documentElement.style.removeProperty(name);
      const vars = getThemeVars(notification.theme);
      for (const [name, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(name, value);
      }
      setNotifications((previous) =>
        upsertNotificationCard(previous, notification).slice(-Math.max(1, notification.maxVisible)),
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
      const pending = await invoke<NotificationPayload[]>("get_pending_notifications");
      for (const notification of pending) push(notification, false);
    })();

    return () => {
      active = false;
      unlisten?.();
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
            initial={{ opacity: 0, y: fromBottom ? 14 : -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: fromBottom ? 8 : -8, scale: 0.97 }}
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
