import { resolveProcedureName } from "@/lib/contracts";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { truncateId } from "@/lib/format";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PendingTx } from "@/store/persisted";

export function isPendingTx(detail: TxHistoryItem | PendingTx): detail is PendingTx {
  return "broadcastAt" in detail;
}

export function describePendingTx(tx: PendingTx, currentTick: number) {
  const progress = pendingTxProgress(tx.targetTick, currentTick);
  const expired = progress.phase === "expired";
  return {
    progress,
    expired,
    kindLabel: tx.contractName?.trim() || "Transfer",
    amountColor: expired ? "var(--color-text-disabled)" : "var(--color-accent)",
    displayTo: tx.contractName ? tx.contractName : truncateId(tx.destination ?? "—"),
  };
}

export function describeConfirmedTx(
  tx: TxHistoryItem,
  identity: string | null,
  contractName: string | undefined,
  fromContract: string | undefined,
) {
  const isIn = tx.destination === identity;
  const flew = tx.moneyFlew;
  const isSc = !!(contractName || fromContract);
  const procedureName = resolveProcedureName(contractName, fromContract, tx.inputType);

  const amountColor = !flew
    ? "var(--color-text-disabled)"
    : isIn
      ? "var(--color-accent)"
      : "var(--color-text-display)";

  const displayTo = isSc
    ? (contractName ?? fromContract ?? truncateId(tx.destination ?? "—"))
    : truncateId(tx.destination ?? "—");

  const kindLabel = isSc ? (procedureName ?? contractName ?? "Contract call") : "Transfer";

  return { isIn, flew, isSc, kindLabel, amountColor, displayTo };
}
