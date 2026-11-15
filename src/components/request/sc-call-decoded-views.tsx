import { formatQu, truncateId } from "@/lib/format";
import { RequestSectionTitle } from "./request-primitives";
import type {
  MultiSignVaultDepositPayload,
  MultiSignVaultReleasePayload,
  MultiSignVaultResetReleasePayload,
  QearnUnlockPayload,
  ScCallRecipient,
} from "./sc-call-decoders";

/** Recipient breakdown for decoded QUtil SendToMany payloads. */
export function ScCallRecipients({ recipients }: { recipients: ScCallRecipient[] }) {
  if (recipients.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <RequestSectionTitle>Recipients ({recipients.length})</RequestSectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", maxHeight: 180, overflowY: "auto" }}>
        {recipients.map((r) => (
          <div key={r.identity} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.03em" }}>
              {truncateId(r.identity, 10, 10)}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
              {formatQu(r.amount)} QU
            </span>
          </div>
        ))}
      </div>
      {recipients.length > 4 && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", textAlign: "right" }}>
          scroll ↑↓ to see all {recipients.length}
        </div>
      )}
    </div>
  );
}

/**
 * One-line human summary for recognised contract calls.
 * The decoded branches are mutually exclusive by contract/input type.
 */
export function ScCallDecodedHeadline({
  requestAmount,
  hasAmount,
  isQearnLock,
  isQUtilBurn,
  decodedQearnUnlock,
  decodedMultiSigDeposit,
  decodedMultiSigRelease,
  decodedMultiSigResetRelease,
}: {
  requestAmount: bigint;
  hasAmount: boolean;
  isQearnLock: boolean;
  isQUtilBurn: boolean;
  decodedQearnUnlock: QearnUnlockPayload | null;
  decodedMultiSigDeposit: MultiSignVaultDepositPayload | null;
  decodedMultiSigRelease: MultiSignVaultReleasePayload | null;
  decodedMultiSigResetRelease: MultiSignVaultResetReleasePayload | null;
}) {
  let text: string | null = null;
  if (isQearnLock && hasAmount) {
    text = `LOCK ${formatQu(requestAmount)} QU FOR STAKING`;
  } else if (isQUtilBurn && hasAmount) {
    text = `BURN ${formatQu(requestAmount)} QU PERMANENTLY`;
  } else if (decodedQearnUnlock) {
    text = `UNLOCK ${formatQu(decodedQearnUnlock.amount)} QU FROM EPOCH ${decodedQearnUnlock.epoch}`;
  } else if (decodedMultiSigDeposit) {
    text = `DEPOSIT INTO MS VAULT #${decodedMultiSigDeposit.vaultId.toString()}`;
  } else if (decodedMultiSigRelease) {
    text = `RELEASE ${formatQu(decodedMultiSigRelease.amount)} QU FROM MS VAULT #${decodedMultiSigRelease.vaultId.toString()} TO ${truncateId(decodedMultiSigRelease.destination, 10, 10)}`;
  } else if (decodedMultiSigResetRelease) {
    text = `RESET PENDING RELEASE FOR MS VAULT #${decodedMultiSigResetRelease.vaultId.toString()}`;
  }

  if (text === null) return null;
  return (
    <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
      {text}
    </div>
  );
}
