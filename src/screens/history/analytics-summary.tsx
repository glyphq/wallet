import { formatQuCompact } from "@/lib/format";
import { compactQu, incomingShare } from "./analytics-helpers";

export function OverviewCard({ netFlow, incoming, outgoing }: { netFlow: bigint; incoming: bigint; outgoing: bigint }) {
  const positive = netFlow >= 0n;
  const share = incomingShare(incoming, outgoing);

  return (
    <section
      aria-labelledby="analytics-net-flow"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        padding: "var(--space-3) 0 var(--space-6)",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ minWidth: 0 }}>
          <span
            id="analytics-net-flow"
            style={{
              display: "block",
              marginBottom: "var(--space-2)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-caption)",
              fontWeight: 600,
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Net flow
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", minWidth: 0 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "clamp(28px, 9vw, var(--text-display))",
                lineHeight: 1,
                letterSpacing: "-0.04em",
                color: positive ? "var(--color-accent)" : "var(--color-status-warning)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {positive ? "+" : "−"}{compactQu(positive ? netFlow : -netFlow)}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-tertiary)" }}>
              QU
            </span>
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, paddingTop: 2, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: positive ? "var(--color-status-success)" : "var(--color-status-warning)", whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} aria-hidden="true" />
          {positive ? "NET IN" : "NET OUT"}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div
          role="img"
          aria-label={`${share.toFixed(0)} percent incoming and ${(100 - share).toFixed(0)} percent outgoing`}
          style={{
            display: "flex",
            width: "100%",
            height: 8,
            overflow: "hidden",
            borderRadius: 999,
            background: "var(--color-border-strong)",
          }}
        >
          <div style={{ width: `${share}%`, minWidth: incoming > 0n ? 3 : 0, background: "var(--color-accent)" }} />
          <div style={{ flex: 1, minWidth: outgoing > 0n ? 3 : 0, background: "var(--color-text-tertiary)" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <FlowValue label="Incoming" value={incoming} accent />
          <FlowValue label="Outgoing" value={outgoing} align="right" />
        </div>
      </div>
    </section>
  );
}

function FlowValue({ label, value, accent = false, align = "left" }: { label: string; value: bigint; accent?: boolean; align?: "left" | "right" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, textAlign: align }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body)", color: accent ? "var(--color-accent)" : "var(--color-text-primary)" }}>
        {compactQu(value)} QU
      </span>
    </div>
  );
}

export function MetricShelf({ transactionCount, averageAmount }: { transactionCount: number; averageAmount: bigint }) {
  return (
    <section
      aria-label="Wallet activity summary"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-2)",
        padding: "var(--space-4) 0 var(--space-6)",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      <MetricText label="Transactions" value={String(transactionCount)} />
      <span style={{ color: "var(--color-border-strong)" }} aria-hidden="true">/</span>
      <MetricText label="Average" value={`${formatQuCompact(averageAmount)} QU`} />
    </section>
  );
}

function MetricText({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6, minHeight: 24 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}
