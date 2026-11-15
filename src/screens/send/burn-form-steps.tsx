import type { CSSProperties, RefObject } from "react";
import { FireIcon, ShieldAlertIcon, Clock01Icon, FlashIcon, Wallet01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { EmbeddedInput } from "@/components/embedded-input";
import { Input } from "@/components/input";
import { TextButton } from "@/components/text-button";
import { formatQu, truncateId } from "@/lib/format";
import { SendStepPanel } from "./send-step-panel";
import { labelStyle, rowGroupStyle, statusCopyStyle, thinDividerStyle } from "./send-ui";

const noticeStyle: CSSProperties = {
  borderLeft: "2px solid var(--color-status-error)",
  padding: "var(--space-2) 0 var(--space-2) var(--space-3)",
  display: "flex", alignItems: "flex-start", gap: "var(--space-2)",
};

export interface BurnInputStepProps {
  amountStr: string;
  amountError: string;
  balance: bigint | null;
  amountRef: RefObject<HTMLInputElement | null>;
  onAmountChange: (value: string) => void;
  onConfirm: () => void;
  canReview: boolean;
}

/** Burn entry step: amount input and irreversible-action warning. */
export function BurnInputStep({
  amountStr,
  amountError,
  balance,
  amountRef,
  onAmountChange,
  onConfirm,
  canReview,
}: BurnInputStepProps) {
  return (
    <SendStepPanel gap="var(--space-4)">
      {/* Warning */}
      <div role="alert" style={noticeStyle}>
        <ShieldAlertIcon size={16} style={{ flexShrink: 0, color: "var(--color-status-error)", marginTop: 2 }} />
        <span style={{ ...statusCopyStyle, fontWeight: 600, color: "var(--color-status-error)" }}>
          Burning permanently destroys QU. Review the amount carefully before continuing.
        </span>
      </div>

      {/* Amount */}
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 280 }}>
          <EmbeddedInput
            ref={amountRef}
            autoComplete="off"
            value={amountStr}
            onChange={(e) => onAmountChange(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && onConfirm()}
            placeholder="0"
            autoFocus
            style={{
              width: "100%", fontSize: "var(--text-display)", fontWeight: 700,
              color: amountError ? "var(--color-status-error)" : amountStr ? "var(--color-text-display)" : "var(--color-text-disabled)",
              letterSpacing: "-0.03em", textAlign: "center", padding: 0,
            }}
          />
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>QU</span>

        {balance !== null && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: "var(--space-2)" }}>
            {formatQu(balance)} available
          </span>
        )}

        {amountError && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-error)", marginTop: "var(--space-1)" }}>
            {amountError}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ paddingBottom: "var(--space-6)" }}>
        <Button variant="danger" onClick={onConfirm} disabled={!canReview}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
            <FireIcon size={16} /> Review burn
          </span>
        </Button>
      </div>
    </SendStepPanel>
  );
}

export interface BurnConfirmStepProps {
  amountStr: string;
  accountName: string;
  identity: string;
  tickLabel: string;
  needsPassword: boolean;
  password: string;
  passwordError: string;
  onPasswordChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  hasPendingTx: boolean;
  canSend: boolean;
  onCancel: () => void;
}

/** Burn confirmation step: facts, password gate, final warning. */
export function BurnConfirmStep({
  amountStr,
  accountName,
  identity,
  tickLabel,
  needsPassword,
  password,
  passwordError,
  onPasswordChange,
  onSend,
  sending,
  hasPendingTx,
  canSend,
  onCancel,
}: BurnConfirmStepProps) {
  return (
    <SendStepPanel scroll="auto" gap="var(--space-4)">
      {/* Amount */}
      <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-status-error)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          {formatQu(amountStr)}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)", marginTop: "var(--space-1)", opacity: 0.7 }}>QU to burn</div>
      </div>

      {/* Warning */}
      <div role="alert" style={noticeStyle}>
        <ShieldAlertIcon size={16} style={{ flexShrink: 0, color: "var(--color-status-error)", marginTop: 2 }} />
        <span style={{ ...statusCopyStyle, fontWeight: 600, color: "var(--color-status-error)" }}>
          Final review. Once broadcast is accepted, this burn cannot be reversed by Glyph or the network.
        </span>
      </div>

      {/* Details */}
      <div aria-label="Burn review details" style={rowGroupStyle}>
        <DetailRow icon={<Wallet01Icon size={16} />} label="From" value={`${accountName} · ${truncateId(identity)}`} valueColor="var(--color-text-secondary)" />
        <div style={thinDividerStyle} />
        <DetailRow icon={<Clock01Icon size={16} />} label="Target tick" value={tickLabel} />
        <div style={thinDividerStyle} />
        <DetailRow icon={<FlashIcon size={16} />} label="Fee" value="None" mono={false} />
      </div>

      {/* Password confirmation (inline) */}
      {needsPassword && (
        <div style={rowGroupStyle}>
          <div style={{ padding: "var(--space-3) 0", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <span style={{ ...labelStyle }}>Wallet password required</span>
            <Input
              type="password"
              value={password}
              label="Wallet password"
              onChange={(e) => onPasswordChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              placeholder="••••••••••"
              autoComplete="current-password"
              error={passwordError || undefined}
            />
          </div>
        </div>
      )}

      {hasPendingTx && (
        <div role="status" style={{ borderLeft: "2px solid var(--color-status-warning)", padding: "var(--space-2) 0 var(--space-2) var(--space-3)", display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
          <Clock01Icon size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)", marginTop: 2 }} />
          <span style={{ ...statusCopyStyle, color: "var(--color-status-warning)" }}>Another transaction is pending from this account. Wait for it to confirm before broadcasting this burn.</span>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
        <Button variant="danger" onClick={onSend} loading={sending} disabled={!canSend || hasPendingTx || (needsPassword && !password)}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
            <FireIcon size={16} /> Broadcast burn
          </span>
        </Button>
        <TextButton type="button" onClick={onCancel} tone="muted" style={{ alignSelf: "center", padding: "var(--space-2) 0" }}>
          Cancel
        </TextButton>
      </div>
    </SendStepPanel>
  );
}
