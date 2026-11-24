import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/button";
import type { AccountMeta } from "@/store/persisted-types";
import { useReviewMode } from "@/screens/request/review-mode";

export function RequestSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-disabled)",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </div>
  );
}

export function RequestDetailRow({
  label,
  value,
  valueColor,
  badge,
  valueStyle,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  badge?: ReactNode;
  valueStyle?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-label)",
          fontWeight: 500,
          color: "var(--color-text-disabled)",
          letterSpacing: "0.05em",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-1)" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: valueColor ?? "var(--color-text-primary)",
            letterSpacing: "0.05em",
            textAlign: "right",
            wordBreak: "break-all",
            ...valueStyle,
          }}
        >
          {value}
        </span>
        {badge ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-disabled)",
              letterSpacing: "0.05em",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function RequestTechnicalBlock({
  children,
  maxHeight = 180,
}: {
  children: ReactNode;
  maxHeight?: number;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        color: "var(--color-text-primary)",
        letterSpacing: "0.05em",
        lineHeight: 1.7,
        maxHeight,
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        padding: "var(--space-3)",
        background: "var(--color-bg-input)",
        borderRadius: "var(--radius-sharp)",
      }}
    >
      {children}
    </div>
  );
}

export function RequestDisclosure({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <details>
      <summary
        style={{
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-sm)",
          color: "var(--color-text-secondary)",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </summary>
      <div style={{ marginTop: "var(--space-2)" }}>{children}</div>
    </details>
  );
}

function RequestActionBar({ children }: { children: ReactNode }) {
  const { approvalWindow } = useReviewMode();
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-3)",
        marginTop: "auto",
        paddingTop: "var(--space-6)",
        ...(approvalWindow
          ? {
              position: "sticky",
              bottom: 0,
              zIndex: 5,
              marginInline: "calc(var(--screen-padding) * -1)",
              padding: "var(--space-3) var(--screen-padding)",
              background: "var(--color-bg-base)",
              borderTop: "1px solid var(--color-border-subtle)",
            }
          : {}),
      }}
    >
      {children}
    </div>
  );
}

export function RequestApprovalActions({
  onReject,
  onApprove,
  approveLabel,
  approveDisabled,
  approveLoading,
}: {
  onReject: () => void;
  onApprove: () => void;
  approveLabel: string;
  approveDisabled?: boolean;
  approveLoading?: boolean;
}) {
  return (
    <RequestActionBar>
      <Button variant="secondary" onClick={onReject} style={{ flex: 1 }}>
        Reject
      </Button>
      <Button onClick={onApprove} loading={approveLoading} disabled={approveDisabled} style={{ flex: 1 }}>
        {approveLabel}
      </Button>
    </RequestActionBar>
  );
}

const INLINE_NOTICE_COLOR = {
  error: "var(--color-status-error)",
  warning: "var(--color-status-warning)",
} as const;

/** Mono status line used inside previews for validation and transaction errors. */
export function RequestInlineNotice({ tone, children }: { tone: "error" | "warning"; children: ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: INLINE_NOTICE_COLOR[tone], letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}

/** Pill account switcher shown when the dApp did not pin a `from` identity. */
export function RequestSigningAccountPicker({
  accounts,
  selectedIndex,
  onSelect,
}: {
  accounts: AccountMeta[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-2)" }}><RequestSectionTitle>Sign as</RequestSectionTitle></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {accounts.filter((a) => !a.hidden).map((acc) => (
          <button
            key={acc.index}
            onClick={() => onSelect(acc.index)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
              letterSpacing: "0.05em", padding: "var(--space-1) var(--space-3)",
              borderRadius: "var(--radius-pill)",
              border: `1px solid ${acc.index === selectedIndex ? "var(--color-text-display)" : "var(--color-border-strong)"}`,
              background: acc.index === selectedIndex ? "var(--color-text-display)" : "transparent",
              color: acc.index === selectedIndex ? "var(--color-bg-base)" : "var(--color-text-secondary)",
              cursor: "pointer",
            }}
          >
            {acc.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Framed checkbox mark shared by the high-value confirmation controls. */
export function RequestCheckboxMark({ checked }: { checked: boolean }) {
  return (
    <div
      className="request-checkbox corner-frame"
      data-checked={checked ? "true" : "false"}
      style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {checked && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-accent-contrast)", lineHeight: 1 }}>✓</span>}
    </div>
  );
}
