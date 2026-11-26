import { formatQu, truncateId } from "@/lib/format";
import type {
  MultiSignVaultDepositPayload,
  MultiSignVaultReleasePayload,
  MultiSignVaultResetReleasePayload,
} from "./sc-call-decoders";

/**
 * One-line human summary for recognised contract calls.
 * The decoded branches are mutually exclusive by contract/input type.
 */
export function ScCallDecodedHeadline({
  decodedMultiSigDeposit,
  decodedMultiSigRelease,
  decodedMultiSigResetRelease,
}: {
  decodedMultiSigDeposit: MultiSignVaultDepositPayload | null;
  decodedMultiSigRelease: MultiSignVaultReleasePayload | null;
  decodedMultiSigResetRelease: MultiSignVaultResetReleasePayload | null;
}) {
  let text: string | null = null;
  if (decodedMultiSigDeposit) {
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
