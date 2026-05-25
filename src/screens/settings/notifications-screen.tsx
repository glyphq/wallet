import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { Input } from "@/components/input";
import { usePersistedStore } from "@/store/persisted";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { requestNotificationPermission } from "@/lib/notifications";
import { formatDate, truncateId } from "@/lib/format";
import { usePollingMode } from "@/hooks/use-polling-profile";

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
  const pollingMode = usePollingMode();

  const enabled = usePersistedStore((s) => s.settings.notificationsEnabled);
  const onReceived = usePersistedStore((s) => s.settings.notifyOnReceived);
  const onSent = usePersistedStore((s) => s.settings.notifyOnSent);
  const onConfirmed = usePersistedStore((s) => s.settings.notifyOnConfirmed);
  const onMissedConfirmations = usePersistedStore((s) => s.settings.notifyOnMissedConfirmations);
  const onLargeIncoming = usePersistedStore((s) => s.settings.notifyOnLargeIncoming);
  const onPriceAlerts = usePersistedStore((s) => s.settings.notifyOnPriceAlerts);
  const notifyWhenLocked = usePersistedStore((s) => s.settings.notifyWhenLocked);
  const hideToTray = usePersistedStore((s) => s.settings.hideToTray);
  const activePollingMs = usePersistedStore((s) => s.settings.pollingIntervalActiveMs);
  const backgroundPollingMs = usePersistedStore((s) => s.settings.pollingIntervalBackgroundMs);
  const trayPollingMs = usePersistedStore((s) => s.settings.pollingIntervalTrayMs);
  const lockedPollingMs = usePersistedStore((s) => s.settings.pollingIntervalLockedMs);
  const largeIncomingThreshold = usePersistedStore((s) => s.settings.largeIncomingThreshold);
  const priceAlertAbove = usePersistedStore((s) => s.settings.priceAlertAbove);
  const priceAlertBelow = usePersistedStore((s) => s.settings.priceAlertBelow);
  const notificationEvents = usePersistedStore((s) => s.notificationEvents);
  const markNotificationEventRead = usePersistedStore((s) => s.markNotificationEventRead);
  const markAllNotificationEventsRead = usePersistedStore((s) => s.markAllNotificationEventsRead);
  const clearNotificationEvents = usePersistedStore((s) => s.clearNotificationEvents);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  const [permDenied, setPermDenied] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "received" | "sent" | "confirmed" | "failed" | "expired" | "deep_link" | "price_alert">("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [txHashFilter, setTxHashFilter] = useState("");

  const unreadCount = notificationEvents.filter((event) => event.readAt === null).length;
  const accountOptions = Array.from(new Set(notificationEvents.map((event) => event.identity).filter((identity): identity is string => !!identity)));
  const filteredEvents = notificationEvents.filter((event) => {
    if (typeFilter !== "all" && event.kind !== typeFilter) return false;
    if (accountFilter !== "all" && event.identity !== accountFilter) return false;
    if (unreadOnly && event.readAt !== null) return false;
    if (txHashFilter.trim()) {
      const query = txHashFilter.trim().toLowerCase();
      if (!(event.txHash?.toLowerCase().includes(query) || event.body.toLowerCase().includes(query))) return false;
    }
    return true;
  });

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

  function setPollingInterval(setting: "pollingIntervalActiveMs" | "pollingIntervalBackgroundMs" | "pollingIntervalTrayMs" | "pollingIntervalLockedMs", value: string) {
    const seconds = Number(value.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    updateSettings({ [setting]: Math.min(60_000, Math.max(2_000, Math.round(seconds * 1000))) });
  }

  function markVisibleRead() {
    for (const event of filteredEvents) {
      if (event.readAt === null) markNotificationEventRead(event.id);
    }
  }

  function markCurrentTypeRead() {
    if (typeFilter === "all") return;
    for (const event of notificationEvents) {
      if (event.kind === typeFilter && event.readAt === null) markNotificationEventRead(event.id);
    }
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
          description="Pending tx confirms successfully on chain"
          value={onConfirmed}
          onChange={(v) => updateSettings({ notifyOnConfirmed: v })}
          disabled={!enabled}
        />
        <SettingRow
          label="Missed confirmations"
          description="Pending tx fails or expires before confirmation"
          value={onMissedConfirmations}
          onChange={(v) => updateSettings({ notifyOnMissedConfirmations: v })}
          disabled={!enabled}
        />
        <SettingRow
          label="Large incoming transfers"
          description="Extra alert when a received transfer meets your threshold"
          value={onLargeIncoming}
          onChange={(v) => updateSettings({ notifyOnLargeIncoming: v })}
          disabled={!enabled || !onReceived}
        />
        <SettingRow
          label="Price alerts"
          description="Alert when QU crosses configured USD thresholds"
          value={onPriceAlerts}
          onChange={(v) => updateSettings({ notifyOnPriceAlerts: v })}
          disabled={!enabled}
        />
      </div>

      <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "var(--space-2)" }}>
        <Input
          label="Large incoming threshold (QU)"
          value={largeIncomingThreshold}
          onChange={(e) => updateSettings({ largeIncomingThreshold: e.target.value.replace(/[^\d]/g, "") })}
          placeholder="500000"
          disabled={!enabled || !onReceived || !onLargeIncoming}
        />
        <Input
          label="Price alert above (USD)"
          value={priceAlertAbove}
          onChange={(e) => updateSettings({ priceAlertAbove: e.target.value.replace(/[^\d.]/g, "") })}
          placeholder="0.2500"
          disabled={!enabled || !onPriceAlerts}
        />
        <Input
          label="Price alert below (USD)"
          value={priceAlertBelow}
          onChange={(e) => updateSettings({ priceAlertBelow: e.target.value.replace(/[^\d.]/g, "") })}
          placeholder="0.1500"
          disabled={!enabled || !onPriceAlerts}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              POLLING PROFILE
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>
              Current mode: {labelForPollingMode(pollingMode)}
            </div>
          </div>
          <Tag variant="neutral">{labelForPollingMode(pollingMode).toUpperCase()}</Tag>
        </div>
        <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Input label="Active (s)" defaultValue={String(activePollingMs / 1000)} onBlur={(e) => setPollingInterval("pollingIntervalActiveMs", e.target.value)} />
          <Input label="Background (s)" defaultValue={String(backgroundPollingMs / 1000)} onBlur={(e) => setPollingInterval("pollingIntervalBackgroundMs", e.target.value)} />
          <Input label="Tray-hidden (s)" defaultValue={String(trayPollingMs / 1000)} onBlur={(e) => setPollingInterval("pollingIntervalTrayMs", e.target.value)} />
          <Input label="Locked (s)" defaultValue={String(lockedPollingMs / 1000)} onBlur={(e) => setPollingInterval("pollingIntervalLockedMs", e.target.value)} />
        </div>
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
        Vault balances, ticks, tx history, and price checks follow the profile above. Sigil
        keeps polling in background, tray-hidden, and locked modes using the configured cadence.
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
        {unreadCount > 0 && (
          <Tag variant="warning">{`${unreadCount} UNREAD`}</Tag>
        )}
      </div>

      <div style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <FilterSelect label="Type" value={typeFilter} onChange={(value) => setTypeFilter(value as typeof typeFilter)} options={[
          { value: "all", label: "All types" },
          { value: "received", label: "Received" },
          { value: "sent", label: "Sent" },
          { value: "confirmed", label: "Confirmed" },
          { value: "failed", label: "Failed" },
          { value: "expired", label: "Expired" },
          { value: "deep_link", label: "Request" },
          { value: "price_alert", label: "Price alert" },
        ]} />
        <FilterSelect label="Account" value={accountFilter} onChange={setAccountFilter} options={[
          { value: "all", label: "All accounts" },
          ...accountOptions.map((identity) => ({ value: identity, label: truncateId(identity, 8, 4) })),
        ]} />
        <Input label="Transaction hash" value={txHashFilter} onChange={(e) => setTxHashFilter(e.target.value)} placeholder="Search tx hash" />
        <SettingRow
          label="Unread only"
          description="Show only unread inbox entries"
          value={unreadOnly}
          onChange={setUnreadOnly}
        />
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
          onClick={markVisibleRead}
          disabled={filteredEvents.length === 0}
          style={ACTION_BUTTON_STYLE(filteredEvents.length > 0)}
        >
          MARK VISIBLE READ
        </button>
        <button
          onClick={markCurrentTypeRead}
          disabled={typeFilter === "all" || notificationEvents.length === 0}
          style={ACTION_BUTTON_STYLE(typeFilter !== "all" && notificationEvents.length > 0)}
        >
          MARK TYPE READ
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
        {filteredEvents.length === 0 ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", padding: "var(--space-4)", textAlign: "center", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)" }}>
            [{notificationEvents.length === 0 ? "NO NOTIFICATION HISTORY YET" : "NO EVENTS MATCH CURRENT FILTERS"}]
          </div>
        ) : (
          filteredEvents.map((event) => (
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
              {(event.identity || event.txHash) && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  {event.identity && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                      ACCOUNT {truncateId(event.identity, 8, 4)}
                    </span>
                  )}
                  {event.txHash && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                      TX {truncateId(event.txHash, 10, 10)}
                    </span>
                  )}
                </div>
              )}
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
    case "price_alert":
      return "warning" as const;
    default:
      return "warning" as const;
  }
}

function labelForEvent(kind: "received" | "sent" | "confirmed" | "failed" | "expired" | "deep_link" | "price_alert") {
  switch (kind) {
    case "received": return "RECEIVED";
    case "sent": return "SENT";
    case "confirmed": return "CONFIRMED";
    case "failed": return "FAILED";
    case "expired": return "EXPIRED";
    case "deep_link": return "REQUEST";
    case "price_alert": return "PRICE";
  }
}

function labelForPollingMode(mode: "active" | "background" | "tray_hidden" | "locked") {
  switch (mode) {
    case "background":
      return "Background";
    case "tray_hidden":
      return "Tray hidden";
    case "locked":
      return "Locked";
    default:
      return "Active";
  }
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <label style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--color-bg-subtle)",
          borderRadius: "var(--radius-sharp)",
          padding: "12px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-sm)",
          color: "var(--color-text-display)",
          width: "100%",
          border: "1px solid var(--color-border-strong)",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
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
