import type { ReactNode } from "react";
import {
  DAPP_EXPIRY_OPTIONS,
  getDappExpiryLabel,
  getDappLimitLabel,
  sanitizeDappExpiryDurationMs,
  sanitizeTransferLimitQu,
  type DappPermissionDecision,
} from "@/lib/dapp-permissions";
import type { ApprovedDapp } from "@/store/persisted-types";

function OutlineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

function ClockIcon() {
  return (
    <OutlineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </OutlineIcon>
  );
}

function LimitIcon() {
  return (
    <OutlineIcon>
      <path d="M4 17h16" />
      <path d="M7 17V7" />
      <path d="M17 17V7" />
      <path d="M7 7h10" />
    </OutlineIcon>
  );
}

function ShieldIcon() {
  return (
    <OutlineIcon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </OutlineIcon>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--color-border-subtle)" }} />;
}

export function DappPolicyControls({
  transferLimitQu,
  expiryDurationMs,
  onTransferLimitChange,
  onExpiryDurationChange,
  showLimit = true,
  idPrefix = "dapp-policy",
}: {
  transferLimitQu: string;
  expiryDurationMs: number | undefined;
  onTransferLimitChange: (value: string) => void;
  onExpiryDurationChange: (value: number | undefined) => void;
  showLimit?: boolean;
  idPrefix?: string;
}) {
  const selectedExpiry = expiryDurationMs === undefined ? "never" : String(expiryDurationMs);
  const limitId = `${idPrefix}-transfer-limit`;
  const expiryId = `${idPrefix}-expiry-duration`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {showLimit && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 48, padding: "var(--space-2) 0" }}>
          <label htmlFor={limitId} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
            <span style={{ color: "var(--color-text-tertiary)" }}><LimitIcon /></span>
            QU limit
          </label>
          <input
            id={limitId}
            inputMode="numeric"
            placeholder="No limit"
            value={transferLimitQu}
            onChange={(event) => onTransferLimitChange(event.target.value)}
            onBlur={() => onTransferLimitChange(sanitizeTransferLimitQu(transferLimitQu) ?? "")}
            style={{
              width: 128,
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--color-border-subtle)",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              letterSpacing: "0.05em",
              padding: "var(--space-2) 0",
              textAlign: "right",
              outline: "none",
            }}
          />
        </div>
      )}
      {showLimit && <Divider />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 48, padding: "var(--space-2) 0" }}>
        <label htmlFor={expiryId} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}><ClockIcon /></span>
          Expiry
        </label>
        <select
          id={expiryId}
          value={selectedExpiry}
          onChange={(event) => {
            const value = event.target.value;
            onExpiryDurationChange(value === "never" ? undefined : sanitizeDappExpiryDurationMs(Number(value)));
          }}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--color-border-subtle)",
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            letterSpacing: "0.05em",
            padding: "var(--space-2) 0",
            textAlign: "right",
            outline: "none",
          }}
        >
          {DAPP_EXPIRY_OPTIONS.map((option) => (
            <option key={option.value ?? "never"} value={option.value === undefined ? "never" : String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function DappPolicyStatus({ decision }: { decision: DappPermissionDecision }) {
  const tone = decision.allowed ? "var(--color-text-secondary)" : "var(--color-status-error)";
  const text = decision.reason ?? (decision.dapp ? `${getDappLimitLabel(decision.dapp)} · ${getDappExpiryLabel(decision.dapp)}` : "Policy ready");

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)", color: tone }}>
      <span style={{ color: decision.allowed ? "var(--color-text-tertiary)" : "var(--color-status-error)", marginTop: 1 }}><ShieldIcon /></span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
}

export function dappPolicySummary(dapp: ApprovedDapp, now = Date.now()): string {
  return `${getDappLimitLabel(dapp)} · ${getDappExpiryLabel(dapp, now)}`;
}
