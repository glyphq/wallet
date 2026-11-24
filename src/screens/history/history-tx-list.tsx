import { KNOWN_CONTRACT_ADDRESSES, resolveProcedureName } from "@/lib/contracts";
import { truncateId, formatQuCompact, formatDate } from "@/lib/format";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PendingTx } from "@/store/persisted";
import { ActivityItem } from "./history-activity-item";
import { pendingTxProgress } from "@/lib/pending-tx-progress";

export function HistoryTxList({
  pending, txs, identity, currentTick, hideBalances, pendingHashes, onSelect,
}: {
  pending: PendingTx[];
  txs: TxHistoryItem[];
  identity: string | null;
  currentTick: number;
  hideBalances: boolean;
  pendingHashes: Set<string>;
  onSelect: (hash: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {pending.map((tx) => (
        <PendingTxRow
          key={`p-${tx.hash}`}
          tx={tx}
          identity={identity}
          currentTick={currentTick}
          hideBalances={hideBalances}
          onSelect={onSelect}
        />
      ))}

      {txs.map((tx) => (
        <ConfirmedTxRow
          key={tx.hash}
          tx={tx}
          identity={identity}
          hideBalances={hideBalances}
          flash={pendingHashes.has(tx.hash)}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function PendingTxRow({
  tx, identity, currentTick, hideBalances, onSelect,
}: {
  tx: PendingTx;
  identity: string | null;
  currentTick: number;
  hideBalances: boolean;
  onSelect: (hash: string) => void;
}) {
  const isIn = tx.destination === identity;
  const progress = pendingTxProgress(tx.targetTick, currentTick);
  const expired = progress.phase === "expired";
  const label = progress.label;
  const labelColor = expired ? "var(--color-status-error)" : "var(--color-status-warning)";
  const address = tx.contractName ?? (isIn ? truncateId(tx.source) : truncateId(tx.destination));
  const time = progress.timingText;

  return (
    <ActivityItem
      className="stagger-item"
      onClick={() => onSelect(tx.hash)}
      label={label}
      labelColor={labelColor}
      address={address}
      time={time}
      amount={hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount)}`}
      amountColor={expired ? "var(--color-text-disabled)" : "var(--color-status-warning)"}
      txType={expired ? "failed" : "pending"}
    />
  );
}

function ConfirmedTxRow({
  tx, identity, hideBalances, flash, onSelect,
}: {
  tx: TxHistoryItem;
  identity: string | null;
  hideBalances: boolean;
  flash: boolean;
  onSelect: (hash: string) => void;
}) {
  const isIn = tx.destination === identity;
  const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
  const fromContract = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
  const isSc = !!(contractName || fromContract);
  const flew = tx.moneyFlew;

  const procedureName = resolveProcedureName(contractName, fromContract, tx.inputType);

  const label = !flew ? "Failed" : isSc ? (procedureName ?? contractName ?? "Contract call") : isIn ? "Received" : "Sent";
  const labelColor = !flew ? "var(--color-status-error)" : isIn ? "var(--color-accent)" : "var(--color-text-secondary)";
  const address = isSc
    ? (contractName ?? fromContract ?? truncateId(isIn ? (tx.source ?? "Unknown") : (tx.destination ?? "Unknown")))
    : truncateId(isIn ? (tx.source ?? "Unknown") : (tx.destination ?? "Unknown"));
  const txType = !flew ? "failed" as const : isSc ? "sc" as const : isIn ? "received" as const : "sent" as const;

  return (
    <ActivityItem
      className={`stagger-item${flash ? " flash-success" : ""}`}
      onClick={() => onSelect(tx.hash)}
      label={label}
      labelColor={labelColor}
      address={address}
      time={formatDate(tx.timestamp) || `Tick ${tx.tickNumber}`}
      amount={hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount)}`}
      amountColor={flew ? (isIn ? "var(--color-accent)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
      txType={txType}
    />
  );
}
