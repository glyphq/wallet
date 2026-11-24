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
    statusLabel: progress.label,
    statusColor: expired ? "var(--color-status-error)" : "var(--color-status-warning)",
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

  let statusLabel: string;
  let statusColor: string;
  let amountColor: string;

  if (!flew) {
    statusLabel = "Failed";
    statusColor = "var(--color-status-error)";
    amountColor = "var(--color-text-disabled)";
  } else if (isSc) {
    statusLabel = procedureName ?? "SC call";
    statusColor = "var(--color-text-secondary)";
    amountColor = "var(--color-text-display)";
  } else if (isIn) {
    statusLabel = "Received";
    statusColor = "var(--color-accent)";
    amountColor = "var(--color-accent)";
  } else {
    statusLabel = "Sent";
    statusColor = "var(--color-text-secondary)";
    amountColor = "var(--color-text-display)";
  }

  const displayTo = isSc
    ? (contractName ?? fromContract ?? truncateId(tx.destination ?? "—"))
    : truncateId(tx.destination ?? "—");

  return { isIn, flew, isSc, statusLabel, statusColor, amountColor, displayTo };
}
