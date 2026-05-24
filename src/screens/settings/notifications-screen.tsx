import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { usePersistedStore } from "@/store/persisted";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { requestNotificationPermission } from "@/lib/notifications";
import { formatDate } from "@/lib/format";

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        background: value && !disabled ? "var(--color-status-success)" : "var(--color-bg-elevated)",
        border: `1px solid ${value && !disabled ? "var(--color-status-success)" : "var(--color-border-strong)"}`,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        padding: 0,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "var(--color-text-display)",
          position: "absolute",
          top: 2,
          left: value ? 18 : 2,
          transition: "left 0.12s",
        }}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "var(--radius-sharp)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label)",
            color: "var(--color-text-secondary)",
            marginTop: "var(--space-1)",
          }}
        >
          {description}
        </div>
      </div>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");

  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);
  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);
  const hideToTray = usePersistedStore((s) => s.settings.hideToTray);
  const notificationEvents = usePersistedStore((s) => s.notificationEvents);
  const markNotificationEventRead = usePersistedStore((s) => s.markNotificationEventRead);
  const markAllNotificationEventsRead = usePersistedStore((s) => s.markAllNotificationEventsRead);
  const clearNotificationEvents = usePersistedStore((s) => s.clearNotificationEvents);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  const [permDenied, setPermDenied] = useState(false);

  async function handleToggleEnabled(v: boolean) {
    if (v) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setPermDenied(true);
        return;
      }
      setPermDenied(false);
    }
    updateSettings({ notificationsEnabled: v });
  }

  async function sendTest() {
    await publishNotificationEvent(createNotificationEvent({
      kind: "deep_link",
      title: "Sigil Notifications Enabled",
      body: "Desktop notifications are working and ready for wallet events.",
    }));
  }

  const statusBar = <ScreenHeader title="Notifications" onBack={() => navigate("/settings")} />;

  return (
    <AppShell
      statusBar={statusBar}
      contentStyle={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {/* Tray */}
      <SettingRow
        label="Hide to tray on close"
        description="Keep Sigil running in the system tray when the window is closed"
        value={hideToTray}
        onChange={(v) => updateSettings({ hideToTray: v })}
      />

      {/* Master toggle */}
      <SettingRow
        label="Desktop notifications"
        description="Show OS notifications for wallet events"
        value={enabled}
        onChange={handleToggleEnabled}
      />

      {permDenied && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-status-error)",
            letterSpacing: "0.05em",
          }}
        >
          [PERMISSION DENIED — allow notifications in your OS settings]
        </div>
      )}

      {isLinux && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            color: "var(--color-text-disabled)",
            lineHeight: 1.5,
          }}
        >
          Linux desktop toasts require Sigil to be installed with its desktop entry. Bundled
          packages register this automatically; when running an unpackaged dev build, install the
          generated `.desktop` file first or notifications may be suppressed by the desktop shell.
        </div>
      )}

      {/* Per-event toggles */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
          marginTop: "var(--space-2)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-text-disabled)",
            letterSpacing: "0.05em",
            marginBottom: "var(--space-1)",
          }}
        >
          NOTIFY WHEN
        </div>

        <SettingRow
          label="QU received"
          description="Balance increases on any account in the active vault"
          value={onReceived}
          onChange={(v) => updateSettings({ notifyOnReceived: v })}
          disabled={!enabled}
        />
        <SettingRow
          label="Notify when locked"
          description="Keep polling balances and fire received notifications even when the vault is locked"
          value={notifyWhenLocked}
          onChange={(v) => updateSettings({ notifyWhenLocked: v })}
          disabled={!enabled || !onReceived}
        />
        <SettingRow
          label="Transaction sent"
          description="Any send, SC call, or burn is broadcast"
          value={onSent}
          onChange={(v) => updateSettings({ notifyOnSent: v })}
          disabled={!enabled}
        />
        <SettingRow
          label="Transaction resolved"
          description="Pending tx confirms on chain or expires"
          value={onConfirmed}
          onChange={(v) => updateSettings({ notifyOnConfirmed: v })}
          disabled={!enabled}
        />
      </div>

      {/* Test button */}
      <button
        onClick={sendTest}
        disabled={!enabled}
        style={{
          marginTop: "var(--space-4)",
          background: "none",
          border: "1px solid var(--color-border-strong)",
          borderRadius: "var(--radius-sharp)",
          padding: "var(--space-3)",
          cursor: enabled ? "pointer" : "default",
          opacity: enabled ? 1 : 0.35,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-sm)",
          color: "var(--color-text-secondary)",
          letterSpacing: "0.05em",
          width: "100%",
        }}
      >
        SEND TEST NOTIFICATION
      </button>

      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-caption)",
          color: "var(--color-text-disabled)",
          marginTop: "var(--space-2)",
          lineHeight: 1.5,
        }}
      >
        Received detection polls all vault accounts every 5 s via QUtil. Notifications
        only fire while Sigil is running — enable "Notify when locked" to keep polling
        after locking the vault.
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            INBOX
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
            Recent wallet and request events, including anything you may have missed.
          </div>
        </div>
        {notificationEvents.some((event) => event.readAt === null) && (
          <Tag variant="warning">{`${notificationEvents.filter((event) => event.readAt === null).length} UNREAD`}</Tag>
        )}
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <button
          onClick={markAllNotificationEventsRead}
          disabled={notificationEvents.length === 0}
          style={ACTION_BUTTON_STYLE(notificationEvents.length > 0)}
        >
          MARK ALL READ
        </button>
        <button
          onClick={clearNotificationEvents}
          disabled={notificationEvents.length === 0}
          style={ACTION_BUTTON_STYLE(notificationEvents.length > 0)}
        >
          CLEAR HISTORY
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
        {notificationEvents.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", padding: "var(--space-4)", textAlign: "center", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)" }}>
            [NO NOTIFICATION HISTORY YET]
          </div>
        ) : (
          notificationEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => markNotificationEventRead(event.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                width: "100%",
                textAlign: "left",
                background: event.readAt === null ? "var(--color-bg-surface)" : "var(--color-bg-base)",
                border: `1px solid ${event.readAt === null ? "var(--color-border-strong)" : "var(--color-border-subtle)"}`,
                borderRadius: "var(--radius-sharp)",
                padding: "var(--space-4)",
                cursor: "pointer",
                opacity: event.readAt === null ? 1 : 0.75,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                <Tag variant={tagVariantForEvent(event.kind)}>{labelForEvent(event.kind)}</Tag>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                  {formatDate(event.createdAt)}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                {event.title}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {event.body}
              </div>
            </button>
          ))
        )}
      </div>
    </AppShell>
  );
}

function tagVariantForEvent(kind: ReturnType<typeof labelForEvent> extends string ? Parameters<typeof labelForEvent>[0] : never) {
  switch (kind) {
    case "received":
    case "confirmed":
      return "success" as const;
    case "failed":
    case "expired":
      return "error" as const;
    case "deep_link":
      return "neutral" as const;
    default:
      return "warning" as const;
  }
}

function labelForEvent(kind: "received" | "sent" | "confirmed" | "failed" | "expired" | "deep_link") {
  switch (kind) {
    case "received": return "RECEIVED";
    case "sent": return "SENT";
    case "confirmed": return "CONFIRMED";
    case "failed": return "FAILED";
    case "expired": return "EXPIRED";
    case "deep_link": return "REQUEST";
  }
}

function ACTION_BUTTON_STYLE(enabled: boolean) {
  return {
    background: "none",
    border: "1px solid var(--color-border-strong)",
    borderRadius: "var(--radius-sharp)",
    padding: "var(--space-2) var(--space-3)",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.4,
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-mono-sm)",
    color: "var(--color-text-secondary)",
    letterSpacing: "0.05em",
  } as const;
}
