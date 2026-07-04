import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { formatDate } from "@/lib/format";

export default function AuditLogScreen() {
  const auditEvents = usePersistedStore((s) => s.auditEvents);
  const clearAuditEvents = usePersistedStore((s) => s.clearAuditEvents);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", paddingBottom: "calc(var(--space-4) + 76px)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Audit log" backTo="/settings/security" />

        {auditEvents.length > 0 && (
          <button
            onClick={clearAuditEvents}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              fontWeight: 500, color: "var(--color-text-disabled)", alignSelf: "flex-start",
            }}
          >
            Clear log
          </button>
        )}

        {auditEvents.length === 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "var(--space-8) 0",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
            color: "var(--color-text-disabled)",
          }}>
            No audit events
          </div>
        )}

        {auditEvents.length > 0 && (
          <div style={{
            background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", overflow: "hidden",
          }}>
            {auditEvents.map((event, i) => (
              <div key={event.id} style={{
                padding: "var(--space-3) var(--space-4)",
                borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {event.title}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500,
                    padding: "1px var(--space-2)", borderRadius: "var(--radius-pill)",
                    background: event.status === "failure" ? "rgba(255,59,48,0.1)" : event.status === "success" ? "rgba(52,199,89,0.1)" : "var(--color-bg-elevated)",
                    color: event.status === "failure" ? "var(--color-status-error)" : event.status === "success" ? "var(--color-status-success)" : "var(--color-text-disabled)",
                  }}>
                    {event.status}
                  </span>
                </div>
                {event.detail && (
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                    {event.detail}
                  </div>
                )}
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: 2 }}>
                  {formatDate(event.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
