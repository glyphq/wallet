import { useMemo } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { useWalletAnalytics } from "@/hooks/use-wallet-analytics";
import { usePersistedStore } from "@/store/persisted";
import { formatDate } from "@/lib/format";
import { buildContractItems, buildCounterpartyItems } from "./analytics-helpers";
import { ActivityHeatmap, MonthlyBars } from "./analytics-charts";
import { EmptyAnalytics, AnalyticsSkeleton } from "./analytics-states";
import { MetricShelf, OverviewCard } from "./analytics-summary";
import { DataRow, RankedList, ReportSection } from "./analytics-table";

export default function AnalyticsScreen() {
  const navigate = useNavigate();
  const { data: analytics, isLoading } = useWalletAnalytics();
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
              <RankedList items={buildCounterpartyItems(analytics.biggestCounterparties)} />
            </ReportSection>
          )}

          {analytics.contractUsage.length > 0 && (
            <ReportSection
              title="Contract activity"
              description="Smart contracts used by this wallet"
            >
              <RankedList items={buildContractItems(analytics.contractUsage)} />
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
