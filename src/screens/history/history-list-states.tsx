import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { HistorySkeletonRows } from "./history-skeleton";

export function HistoryLoadingMoreRows() {
  return <HistorySkeletonRows />;
}

export function HistoryEmptyState() {
  return (
    <EmptyCollectionState
      title="No activity yet"
      description="Incoming and outgoing transactions will appear here."
    />
  );
}

export function HistoryLoadMore({ visibleCount, totalCount, onShowOlder }: { visibleCount: number; totalCount: number; onShowOlder: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-5) 0" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>
        Showing {visibleCount} of {totalCount} loaded transactions
      </div>
      <Button variant="secondary" shape="sharp" size="sm" onClick={onShowOlder}>
        Show older activity
      </Button>
    </div>
  );
}
