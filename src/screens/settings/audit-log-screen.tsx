import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";

export default function AuditLogScreen() {
  const navigate = useNavigate();
  const auditEvents = usePersistedStore((s) => s.auditEvents);
  const clearAuditEvents = usePersistedStore((s) => s.clearAuditEvents);

  const statusBar = <ScreenHeader title="Audit log" onBack={() => navigate("/settings/security")} />;

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {auditEvents.length > 0 && (
        <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={clearAuditEvents}>
          Clear log
        </Button>
      )}

      {auditEvents.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [NO AUDIT EVENTS]
        </div>
      )}

      {auditEvents.map((event) => (
        <div key={event.id} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", padding: "var(--space-3)", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
              {event.title}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: event.status === "failure" ? "var(--color-status-error)" : event.status === "success" ? "var(--color-status-success)" : "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              {event.status.toUpperCase()}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
            {event.detail}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            {new Date(event.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </AppShell>
  );
}
