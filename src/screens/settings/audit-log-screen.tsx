
import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";

export default function AuditLogScreen() {
  const auditEvents = usePersistedStore((s) => s.auditEvents);
  const clearAuditEvents = usePersistedStore((s) => s.clearAuditEvents);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column" }}>
      <motion.div {...presets.fadeIn}>
        <SettingsPageHeader title="Audit log" backTo="/settings/security" />
        {auditEvents.length > 0 && (
          <button
            onClick={clearAuditEvents}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}
          >
            Clear log
          </button>
        )}

        {auditEvents.length === 0 && (
          <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
            No audit events
          </div>
        )}

        {auditEvents.map((event, index) => (
          <div key={event.id}>
            {index > 0 && <div style={{ borderTop: "1px solid var(--color-border)" }} />}
            <div style={{ padding: "var(--space-3) 0", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                  {event.title}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: event.status === "failure" ? "var(--color-status-error)" : event.status === "success" ? "var(--color-status-success)" : "var(--color-text-disabled)" }}>
                  {event.status === "failure" ? "Failure" : event.status === "success" ? "Success" : event.status}
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                {event.detail}
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-small)", color: "var(--color-text-disabled)" }}>
                {new Date(event.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </AppShell>
  );
}
