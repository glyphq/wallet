import { formatDate } from "@/lib/format";
import type { RuntimeIssue } from "@/store/persisted";
import { ActionRow, DiagnosticRow, DiagnosticSection } from "./diagnostic-primitives";

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
    <DiagnosticSection title="Runtime issues" description={issues.length === 0 ? "No issues have been recorded during this session." : `${issues.length} recent issue${issues.length === 1 ? "" : "s"}.`}>
      {issues.length === 0 ? (
        <DiagnosticRow label="Status" value="No issues recorded" tone="success" />
      ) : issues.map((issue) => (
        <div key={issue.id} style={{ padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between", alignItems: "baseline" }}>
            <strong style={{ color: "var(--color-text-primary)", fontSize: "var(--text-label)", fontWeight: 600 }}>{issue.title}</strong>
            <span style={{ flexShrink: 0, color: issue.source === "storage" ? "var(--color-status-error)" : issue.source === "updater" ? "var(--color-status-warning)" : "var(--color-text-secondary)", fontSize: "var(--text-caption)", textTransform: "capitalize" }}>{issue.source}</span>
          </div>
          <span style={{ display: "block", marginTop: 3, color: "var(--color-text-secondary)", fontSize: "var(--text-caption)", lineHeight: 1.45 }}>{issue.detail}</span>
          <span style={{ display: "block", marginTop: 4, color: "var(--color-text-disabled)", fontSize: "var(--text-caption)" }}>{formatDate(issue.createdAt)}</span>
        </div>
      ))}
      {totalCount > 0 && <ActionRow label={`Clear ${totalCount} runtime issue${totalCount === 1 ? "" : "s"}`} onClick={onClear} />}
    </DiagnosticSection>
  );
}
