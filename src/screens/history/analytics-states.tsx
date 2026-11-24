import { AsciiSkeleton } from "ascii-reveal";
import { Button } from "@/components/button";

export function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ padding: "var(--space-3) 0 var(--space-6)", borderBottom: "1px solid var(--color-border-default)" }}>
        <AsciiSkeleton as="div" variant="scan" rows={1} width={72} height={12} animate={false} />
        <div style={{ marginTop: "var(--space-3)" }}>
          <AsciiSkeleton as="div" variant="scan" rows={2} width="62%" height={38} animate={false} seed={2} />
        </div>
        <div style={{ marginTop: "var(--space-6)" }}>
          <AsciiSkeleton as="div" variant="scan" rows={1} width="100%" height={8} animate={false} seed={3} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-3)" }}>
          <AsciiSkeleton as="div" variant="scan" rows={1} width={92} height={28} animate={false} seed={4} />
          <AsciiSkeleton as="div" variant="scan" rows={1} width={92} height={28} animate={false} seed={5} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)", paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-default)" }}>
        <AsciiSkeleton as="div" variant="scan" rows={1} width={112} height={20} animate={false} seed={6} />
        <AsciiSkeleton as="div" variant="scan" rows={1} width={132} height={20} animate={false} seed={7} />
      </div>
      <div style={{ padding: "var(--space-4) 0" }}>
        <AsciiSkeleton as="div" variant="scan" rows={1} width={120} height={18} animate={false} seed={8} />
        <div style={{ marginTop: "var(--space-4)" }}>
          <AsciiSkeleton as="div" variant="scan" rows={4} width="100%" height={150} animate={false} seed={9} />
        </div>
      </div>
    </div>
  );
}

export function EmptyAnalytics({ onViewHistory }: { onViewHistory: () => void }) {
  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-8) var(--space-4)", textAlign: "center" }}>
      <div style={{ width: 72, height: 72, display: "grid", placeItems: "center", border: "1px dashed var(--color-border-strong)", borderRadius: "50%", color: "var(--color-text-tertiary)" }} aria-hidden="true">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-section)" }}>—</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-section)", fontWeight: 600, color: "var(--color-text-primary)" }}>No activity yet</h2>
        <p style={{ maxWidth: 260, margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
          Transaction patterns and wallet insights will appear here as you use Glyph.
        </p>
      </div>
      <Button variant="secondary" shape="sharp" size="sm" onClick={onViewHistory}>View transaction history</Button>
    </div>
  );
}
