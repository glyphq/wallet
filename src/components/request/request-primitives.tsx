import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/button";
import type { AccountMeta } from "@/store/persisted-types";
import { DropdownSelect } from "@/components/dropdown-select";
import { StickyFooter } from "@/components/sticky-footer";
import { RequestExpiryNotch, RequestQueueNotch } from "@/screens/request/sheet-layout";
import { MarbleAvatar } from "@/components/marble-avatar";
import { truncateId } from "@/lib/format";
import { useRequestStatus } from "@/screens/request/request-status-context";
import { CheckmarkCircle01Icon, DisconnectIcon } from "@/lib/icons";

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
  const { expirySecsLeft, pendingRequestCount } = useRequestStatus();
  const queued = pendingRequestCount > 1 ? pendingRequestCount - 1 : 0;
  return (
    <StickyFooter
      queueNotch={queued > 0 ? <RequestQueueNotch count={queued} /> : undefined}
      notch={expirySecsLeft !== null ? <RequestExpiryNotch seconds={expirySecsLeft} /> : undefined}
    >
      {children}
    </StickyFooter>
  );
}

export function RequestApprovalActions({
  onReject,
  onApprove,
  approveLabel,
  approveDisabled,
  approveLoading,
  approveIcon,
}: {
  onReject: () => void;
  onApprove: () => void;
  approveLabel: string;
  approveDisabled?: boolean;
  approveLoading?: boolean;
  approveIcon?: ReactNode;
}) {
  return (
    <RequestActionBar>
      <Button onClick={onApprove} loading={approveLoading} disabled={approveDisabled} style={{ flex: 1 }}>
        {approveIcon ?? <CheckmarkCircle01Icon size={16} aria-hidden="true" />}
        {approveLabel}
      </Button>
      <Button variant="secondary" onClick={onReject} style={{ flex: 1 }}>
        <DisconnectIcon size={15} aria-hidden="true" />
        Reject
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

/** Account switcher shown when the dApp did not pin a `from` identity. */
export function RequestSigningAccountPicker({
  accounts,
  selectedIndex,
  onSelect,
}: {
  accounts: AccountMeta[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const visible = accounts.filter((account) => !account.hidden);
  return (
    <DropdownSelect
      label="Sign as"
      value={String(selectedIndex)}
      options={visible.map((account) => ({
        value: String(account.index),
        label: account.identity ? truncateId(account.identity, 8, 8) : account.name,
        icon: <MarbleAvatar seed={account.identity ?? String(account.index)} size={22} />,
      }))}
      onChange={(value) => onSelect(Number(value))}
    />
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
