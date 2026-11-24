import { formatQu, truncateId } from "@/lib/format";
import type {
  MultiSignVaultDepositPayload,
  MultiSignVaultReleasePayload,
  MultiSignVaultResetReleasePayload,
  QearnUnlockPayload,
} from "./sc-call-decoders";

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
