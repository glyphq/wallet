import { SettingsSectionLabel } from "@/components/settings-section-elements";
import { DappPolicyControls } from "@/components/dapp-policy-controls";
import type { ApprovedDapp } from "@/store/persisted";
import { makeDappExpiresAt, sanitizeTransferLimitQu } from "@/lib/dapp-permissions";

/** Transfer ceiling and expiry controls for one dApp approval. */
export function DappLimits({
  dapp,
  hasTransferLikePermission,
  policyIdPrefix,
  onPolicyChange,
}: {
  dapp: ApprovedDapp;
  hasTransferLikePermission: boolean;
  policyIdPrefix: string;
  onPolicyChange: (policy: Pick<ApprovedDapp, "transferLimitQu" | "expiryDurationMs" | "expiresAt">) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <SettingsSectionLabel>Limits</SettingsSectionLabel>
      <DappPolicyControls
        transferLimitQu={dapp.transferLimitQu ?? ""}
        expiryDurationMs={dapp.expiryDurationMs}
        onTransferLimitChange={(value) => onPolicyChange({
          transferLimitQu: sanitizeTransferLimitQu(value),
          expiryDurationMs: dapp.expiryDurationMs,
          expiresAt: dapp.expiresAt,
        })}
        onExpiryDurationChange={(durationMs) => onPolicyChange({
          transferLimitQu: dapp.transferLimitQu,
          expiryDurationMs: durationMs,
          expiresAt: makeDappExpiresAt(durationMs),
        })}
        showLimit={hasTransferLikePermission}
        idPrefix={policyIdPrefix}
      />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
        {hasTransferLikePermission ? "Limit caps each transfer-like request." : "Expiry controls this connection."}
      </span>
    </div>
  );
}
