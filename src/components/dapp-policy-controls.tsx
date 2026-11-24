import type { ReactNode } from "react";
import { DropdownSelect } from "@/components/dropdown-select";
import { Input } from "@/components/input";
import {
  DAPP_EXPIRY_OPTIONS,
  getDappExpiryLabel,
  getDappLimitLabel,
  sanitizeDappExpiryDurationMs,
  sanitizeTransferLimitQu,
  type DappPermissionDecision,
} from "@/lib/dapp-permissions";

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

function ShieldIcon() {
  return (
    <OutlineIcon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </OutlineIcon>
  );
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
    <div style={{ display: "grid", gridTemplateColumns: showLimit ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: "var(--space-3)" }}>
      {showLimit ? (
        <Input
          id={limitId}
          label="QU limit"
          inputMode="numeric"
          placeholder="No limit"
          value={transferLimitQu}
          onChange={(event) => onTransferLimitChange(event.target.value)}
          onBlur={() => onTransferLimitChange(sanitizeTransferLimitQu(transferLimitQu) ?? "")}
          autoComplete="off"
        />
      ) : null}
      <DropdownSelect
        id={expiryId}
        label="Expiry"
        value={selectedExpiry}
        options={DAPP_EXPIRY_OPTIONS.map((option) => ({
          value: option.value === undefined ? "never" : String(option.value),
          label: option.label,
        }))}
        onChange={(value) => {
          onExpiryDurationChange(value === "never" ? undefined : sanitizeDappExpiryDurationMs(Number(value)));
        }}
      />
    </div>
  );
}

export function DappPolicyStatus({ decision, showLimit = true }: { decision: DappPermissionDecision; showLimit?: boolean }) {
  const tone = decision.allowed ? "var(--color-text-secondary)" : "var(--color-status-error)";
  const text = decision.reason ?? (decision.dapp ? `${showLimit ? `${getDappLimitLabel(decision.dapp)} · ` : ""}${getDappExpiryLabel(decision.dapp)}` : "Policy ready");

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)", color: tone }}>
      <span style={{ color: decision.allowed ? "var(--color-text-tertiary)" : "var(--color-status-error)", marginTop: 1 }}><ShieldIcon /></span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
}

