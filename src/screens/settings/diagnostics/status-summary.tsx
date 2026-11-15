import type { NetworkHealth } from "@/hooks/use-network-health";

const STATUS_STYLES: Record<string, { color: string; label: string; summary: string }> = {
  healthy: { color: "var(--color-status-success)", label: "Connected", summary: "Glyph is receiving live network data." },
  degraded: { color: "var(--color-status-warning)", label: "Slow connection", summary: "Live network data is taking longer than usual." },
  offline: { color: "var(--color-status-error)", label: "Offline", summary: "Glyph cannot currently reach the network." },
};

/** Overall connection banner at the top of the diagnostics screen. */
export function NetworkStatusSummary({ health }: { health: NetworkHealth }) {
  const status = STATUS_STYLES[health] ?? STATUS_STYLES.offline;

  return (
    <section aria-label="Overall status" style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)" }}>
      <span aria-hidden="true" style={{ width: 10, height: 10, marginTop: 5, borderRadius: "50%", flexShrink: 0, background: status.color, boxShadow: `0 0 0 4px color-mix(in srgb, ${status.color} 15%, transparent)` }} />
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)" }}>{status.label}</strong>
        <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>{status.summary}</span>
      </div>
    </section>
  );
}
