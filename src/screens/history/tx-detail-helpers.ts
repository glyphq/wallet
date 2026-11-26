import { resolveProcedureName } from "@/lib/contracts";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PendingTx } from "@/store/persisted";

export function isPendingTx(detail: TxHistoryItem | PendingTx): detail is PendingTx {
  return "broadcastAt" in detail;
}

export function formatTransactionTimestamp(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export function describePendingTx(tx: PendingTx) {
  return {
    kindLabel: tx.contractName?.trim() || "Transfer",
    amountColor: "var(--color-text-primary)",
  };
}

export function describeConfirmedTx(
  tx: TxHistoryItem,
  contractName: string | undefined,
  fromContract: string | undefined,
) {
  const procedureName = resolveProcedureName(contractName, fromContract, tx.inputType);
  return {
    kindLabel: contractName || fromContract ? (procedureName ?? contractName ?? fromContract ?? "Contract call") : "Transfer",
    amountColor: tx.moneyFlew ? "var(--color-text-primary)" : "var(--color-text-disabled)",
  };
}

