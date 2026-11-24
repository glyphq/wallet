import { formatDate } from "@/lib/format";
import { Button } from "@/components/button";
import type { RuntimeIssue } from "@/store/persisted";
import { DiagnosticRow, DiagnosticSection } from "./diagnostic-primitives";

/** Recent runtime issues with a clear action. */
export function RuntimeIssuesSection({
  issues,
  totalCount,
  onClear,
}: {
  issues: RuntimeIssue[];
  totalCount: number;
  onClear: () => void;
}) {
  return (
    <DiagnosticSection title="Runtime issues">
      {issues.length === 0 ? (
        <DiagnosticRow label="Status" value="None recorded" tone="success" />
      ) : (
        <>
          {issues.map((issue) => (
            <div key={issue.id} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "var(--space-2) 0" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>{issue.title}</span>
                <span style={{ flexShrink: 0, color: issue.source === "storage" ? "var(--color-status-error)" : issue.source === "updater" ? "var(--color-status-warning)" : "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)" }}>{issue.source}</span>
              </div>
              <span style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)" }}>{issue.detail}</span>
              <span style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)" }}>{formatDate(issue.createdAt)}</span>
            </div>
          ))}
          {totalCount > 0 ? (
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "var(--space-2)" }}>
              <Button variant="ghost" size="sm" style={{ width: "auto" }} onClick={onClear}>
                Clear issues
              </Button>
            </div>
          ) : null}
        </>
      )}
    </DiagnosticSection>
  );
}
