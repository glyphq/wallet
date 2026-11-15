import { Button } from "@/components/button";
import { StatusText } from "./history-ui";

export function HistoryLoadingRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4) 0" }}>
      {[120, 180, 140, 160].map((w) => (
        <div key={w} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="skeleton" style={{ width: w, height: 16 }} />
            <div className="skeleton" style={{ width: 100, height: 12 }} />
          </div>
          <div className="skeleton" style={{ width: 80, height: 16 }} />
        </div>
      ))}
    </div>
  );
}

export function HistoryLoadingMoreRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4) 0" }}>
      {[140, 160, 120].map((w) => (
        <div key={w} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="skeleton" style={{ width: w, height: 16 }} />
            <div className="skeleton" style={{ width: 100, height: 12 }} />
          </div>
          <div className="skeleton" style={{ width: 80, height: 16 }} />
        </div>
      ))}
    </div>
  );
}

export function HistoryEmptyState({ hasAnyActivity }: { hasAnyActivity: boolean }) {
  if (hasAnyActivity) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-12) 0" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)", marginBottom: "var(--space-3)" }}>
          No transactions yet
        </div>
      </div>
    );
  }
  return <StatusText color="var(--color-text-disabled)">No results</StatusText>;
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
