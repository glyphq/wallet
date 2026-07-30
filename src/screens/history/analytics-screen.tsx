import { useMemo } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Identicon } from "@/components/identicon";
import { ScreenHeader } from "@/components/screen-header";
import { useVaultAnalytics } from "@/hooks/use-vault-analytics";
import { usePersistedStore } from "@/store/persisted";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { truncateId, formatDate, formatQuCompact } from "@/lib/format";
import type { MonthlySummaryStat, DailyActivityStat } from "@/lib/history-analytics";

const FMT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 });

function compactQu(value: bigint): string {
  return FMT.format(value);
}

export default function AnalyticsScreen() {
  const navigate = useNavigate();
  const { data: analytics, isLoading } = useVaultAnalytics();
  const notificationEvents = usePersistedStore((s) => s.notificationEvents);
  const priceAlerts = useMemo(
    () => notificationEvents.filter((event) => event.kind === "price_alert").slice(0, 10),
    [notificationEvents],
  );

  return (
    <AppShell
      statusBar={<ScreenHeader title="Analytics" onBack={() => navigate("/history")} backAriaLabel="Back to history" />}
      contentStyle={{ padding: "var(--space-5)", gap: 0 }}
    >
      {isLoading && !analytics && <AnalyticsSkeleton />}

      {!isLoading && !analytics && (
        <EmptyAnalytics onViewHistory={() => navigate("/history")} />
      )}

      {analytics && (
        <>
          <OverviewCard
            netFlow={analytics.netFlow}
            incoming={analytics.totalIncoming}
            outgoing={analytics.totalOutgoing}
          />

          <MetricShelf
            transactionCount={analytics.txCount}
            averageAmount={analytics.avgTxAmount}
          />

          {analytics.monthlySummaries.length > 0 && (
            <ReportSection
              title="Monthly flow"
              description="Incoming and outgoing volume by month"
            >
              <MonthlyBars summaries={analytics.monthlySummaries} />
            </ReportSection>
          )}

          {analytics.biggestCounterparties.length > 0 && (
            <ReportSection
              title="Top counterparties"
              description="Your highest-volume connections"
            >
              <RankedList
                items={analytics.biggestCounterparties.map((item) => ({
                  id: item.identity,
                  kind: "identity" as const,
                  primary: KNOWN_CONTRACT_ADDRESSES[item.identity] ?? truncateId(item.identity, 8, 6),
                  secondary: `${truncateId(item.identity, 6, 5)} · ${item.count} ${item.count === 1 ? "transaction" : "transactions"}`,
                  value: `${compactQu(item.volume)} QU`,
                }))}
              />
            </ReportSection>
          )}

          {analytics.contractUsage.length > 0 && (
            <ReportSection
              title="Contract activity"
              description="Smart contracts used by this wallet"
            >
              <RankedList
                items={analytics.contractUsage.map((item) => ({
                  id: item.contract,
                  kind: "contract" as const,
                  primary: item.contract,
                  secondary: `${item.count} ${item.count === 1 ? "call" : "calls"} · smart contract`,
                  value: `${compactQu(item.volume)} QU`,
                }))}
              />
            </ReportSection>
          )}

          {analytics.dailyActivity.length > 0 && (
            <ReportSection
              title="Activity"
              description="Transactions during the last 12 weeks"
            >
              <ActivityHeatmap days={analytics.dailyActivity} />
            </ReportSection>
          )}
        </>
      )}

      {priceAlerts.length > 0 && (
        <ReportSection
          title="Price alerts"
          description="Recently triggered thresholds"
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {priceAlerts.map((event, index) => (
              <DataRow
                key={event.id}
                primary={event.title}
                secondary={formatDate(event.createdAt)}
                value={event.body}
                bordered={index > 0}
              />
            ))}
          </div>
        </ReportSection>
      )}
    </AppShell>
  );
}

function OverviewCard({ netFlow, incoming, outgoing }: { netFlow: bigint; incoming: bigint; outgoing: bigint }) {
  const positive = netFlow >= 0n;
  const total = incoming + outgoing;
  const incomingShare = total > 0n ? Number((incoming * 1000n) / total) / 10 : 50;

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
          aria-label={`${incomingShare.toFixed(0)} percent incoming and ${(100 - incomingShare).toFixed(0)} percent outgoing`}
          style={{
            display: "flex",
            width: "100%",
            height: 8,
            overflow: "hidden",
            borderRadius: 999,
            background: "var(--color-border-strong)",
          }}
        >
          <div style={{ width: `${incomingShare}%`, minWidth: incoming > 0n ? 3 : 0, background: "var(--color-accent)" }} />
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

function MetricShelf({ transactionCount, averageAmount }: { transactionCount: number; averageAmount: bigint }) {
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

function ReportSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        padding: "var(--space-6) 0",
        borderBottom: "1px solid var(--color-border-default)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
          {title}
        </h2>
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function RankedList({ items }: { items: Array<{ id: string; kind: "identity" | "contract"; primary: string; secondary: string; value: string }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, index) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gridTemplateColumns: "36px minmax(0, 1fr) auto",
            alignItems: "center",
            gap: "var(--space-3)",
            minHeight: 62,
            borderTop: index > 0 ? "1px solid var(--color-border-subtle)" : undefined,
          }}
        >
          <Identicon kind="identity" seed={item.id} label={item.primary} size={36} radius={9} style={{ flexShrink: 0, opacity: item.kind === "contract" ? 0.82 : 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.primary}
            </div>
            <div style={{ marginTop: 3, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.secondary}
            </div>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DataRow({ primary, secondary, value, bordered = false }: { primary: string; secondary: string; value: string; bordered?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: "var(--space-3)", minHeight: 52, borderTop: bordered ? "1px solid var(--color-border-subtle)" : undefined }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {primary}
        </div>
        <div style={{ marginTop: 2, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
          {secondary}
        </div>
      </div>
      <span style={{ maxWidth: 140, fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </div>
  );
}

function MonthlyBars({ summaries }: { summaries: MonthlySummaryStat[] }) {
  const visible = summaries.slice(-6);
  const maxVolume = visible.reduce((maximum, summary) => {
    const total = summary.incoming + summary.outgoing;
    return total > maximum ? total : maximum;
  }, 0n);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)" }} aria-label="Monthly flow legend">
        <LegendText label="Incoming" color="var(--color-accent)" />
        <span style={{ color: "var(--color-border-strong)" }} aria-hidden="true">/</span>
        <LegendText label="Outgoing" color="var(--color-text-tertiary)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
      {visible.map((summary, index) => {
        const incomingWidth = maxVolume > 0n ? Number((summary.incoming * 1000n) / maxVolume) / 10 : 0;
        const outgoingWidth = maxVolume > 0n ? Number((summary.outgoing * 1000n) / maxVolume) / 10 : 0;
        return (
          <div key={summary.sortKey} style={{ display: "grid", gridTemplateColumns: "62px minmax(0, 1fr) 46px", alignItems: "center", gap: "var(--space-3)", minHeight: 54, borderTop: index > 0 ? "1px solid var(--color-border-subtle)" : undefined }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-primary)" }}>{summary.month}</div>
              <div style={{ marginTop: 2, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{summary.count} tx</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <VolumeBar width={incomingWidth} color="var(--color-accent)" label={`${compactQu(summary.incoming)} QU incoming`} />
              <VolumeBar width={outgoingWidth} color="var(--color-text-tertiary)" label={`${compactQu(summary.outgoing)} QU outgoing`} />
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", textAlign: "right" }}>
              {compactQu(summary.incoming + summary.outgoing)}
            </span>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function LegendText({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

function VolumeBar({ width, color, label }: { width: number; color: string; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ height: 5, overflow: "hidden", borderRadius: 999, background: "var(--color-border-strong)" }}>
      <div style={{ width: `${Math.max(width, width > 0 ? 2 : 0)}%`, height: "100%", borderRadius: 999, background: color }} />
    </div>
  );
}

function ActivityHeatmap({ days }: { days: DailyActivityStat[] }) {
  const max = Math.max(...days.map((day) => day.count), 1);
  const dayMap = new Map(days.map((day) => [day.date, day.count]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells: { date: string; count: number }[] = [];

  for (let offset = 83; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    cells.push({ date: key, count: dayMap.get(key) ?? 0 });
  }

  const weeks = Array.from({ length: 12 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const activeDays = cells.filter((cell) => cell.count > 0).length;
  const totalTransactions = cells.reduce((total, cell) => total + cell.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }} aria-label={`${totalTransactions} transactions across ${activeDays} active days`}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {week.map((cell) => {
              const intensity = cell.count === 0 ? 0 : Math.max(0.18, cell.count / max);
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.count} ${cell.count === 1 ? "transaction" : "transactions"}`}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    maxHeight: 16,
                    borderRadius: 3,
                    background: cell.count === 0
                      ? "var(--color-border-strong)"
                      : `color-mix(in srgb, var(--color-accent) ${Math.round(intensity * 100)}%, var(--color-border-strong))`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
        <span>{activeDays} active days</span>
        <span>{totalTransactions} transactions</span>
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ padding: "var(--space-3) 0 var(--space-6)", borderBottom: "1px solid var(--color-border-default)" }}>
        <div className="skeleton" style={{ width: 72, height: 12 }} />
        <div className="skeleton" style={{ width: "62%", height: 38, marginTop: "var(--space-3)" }} />
        <div className="skeleton" style={{ width: "100%", height: 8, marginTop: "var(--space-6)", borderRadius: 999 }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-3)" }}>
          <div className="skeleton" style={{ width: 92, height: 28 }} />
          <div className="skeleton" style={{ width: 92, height: 28 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)", paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-default)" }}>
        <div className="skeleton" style={{ width: 112, height: 20 }} />
        <div className="skeleton" style={{ width: 132, height: 20 }} />
      </div>
      <div style={{ padding: "var(--space-4) 0" }}>
        <div className="skeleton" style={{ width: 120, height: 18 }} />
        <div className="skeleton" style={{ width: "100%", height: 150, marginTop: "var(--space-4)" }} />
      </div>
    </div>
  );
}

function EmptyAnalytics({ onViewHistory }: { onViewHistory: () => void }) {
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
