import { KNOWN_CONTRACT_ADDRESSES, resolveProcedureName } from "@/lib/contracts";
import { truncateId, formatQuCompact } from "@/lib/format";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PendingTx } from "@/store/persisted";
import { pendingTxProgress } from "@/lib/pending-tx-progress";
import { ContractMark } from "@/components/contract-mark";
import { FramedAvatar } from "@/components/framed-avatar";
import { ActivityItem } from "./history-activity-item";

function dayKey(timestamp: number | null): string {
  if (!timestamp) return "unknown";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(timestamp: number | null): string {
  if (!timestamp) return "Unknown date";
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatClock(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", padding: "var(--space-4) 0 var(--space-1)" }}>
      {children}
    </div>
  );
}

const HISTORY_MARK_SIZE = 34;

function RowLeading({ contractName, identity }: { contractName?: string | null; identity: string | null }) {
  if (contractName) {
    return (
      <span
        style={{
          flexShrink: 0,
          width: HISTORY_MARK_SIZE,
          height: HISTORY_MARK_SIZE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: "var(--color-bg-surface)",
        }}
      >
        <ContractMark name={contractName} size={18} />
      </span>
    );
  }
  return <FramedAvatar seed={identity ?? "unknown"} size={HISTORY_MARK_SIZE} />;
}

export function HistoryTxList({
  pending, txs, identity, currentTick, hideBalances, onSelect,
}: {
  pending: PendingTx[];
  txs: TxHistoryItem[];
  identity: string | null;
  currentTick: number;
  hideBalances: boolean;
  onSelect: (hash: string) => void;
}) {
  const groups: { key: string; label: string; txs: TxHistoryItem[] }[] = [];
  for (const tx of txs) {
    const key = dayKey(tx.timestamp);
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, label: dayLabel(tx.timestamp), txs: [] };
      groups.push(group);
    }
    group.txs.push(tx);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {pending.length > 0 ? (
        <div>
          <SectionLabel>Pending</SectionLabel>
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
        </div>
      ) : null}

      {groups.map((group) => (
        <div key={group.key}>
          <SectionLabel>{group.label}</SectionLabel>
          {group.txs.map((tx) => (
            <ConfirmedTxRow
              key={tx.hash}
              tx={tx}
              identity={identity}
              hideBalances={hideBalances}
              onSelect={onSelect}
            />
          ))}
        </div>
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
  const address = tx.contractName ?? (isIn ? truncateId(tx.source) : truncateId(tx.destination));
  const contractLabel = tx.contractName?.split("·")[0]?.trim() || null;
  const counterparty = isIn ? tx.source : tx.destination;

  return (
    <ActivityItem
      className="stagger-item"
      onClick={() => onSelect(tx.hash)}
      label={progress.label}
      labelColor={expired ? "var(--color-status-error)" : "var(--color-status-warning)"}
      address={address}
      time=""
      amount={hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount)}`}
      amountColor={expired ? "var(--color-text-disabled)" : "var(--color-status-warning)"}
      txType={expired ? "failed" : "pending"}
      leading={<RowLeading contractName={contractLabel} identity={counterparty} />}
    />
  );
}

function ConfirmedTxRow({
  tx, identity, hideBalances, onSelect,
}: {
  tx: TxHistoryItem;
  identity: string | null;
  hideBalances: boolean;
  onSelect: (hash: string) => void;
}) {
  const isIn = tx.destination === identity;
  const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
  const fromContract = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
  const isSc = Boolean(contractName || fromContract);
  const flew = tx.moneyFlew;
  const procedureName = resolveProcedureName(contractName, fromContract, tx.inputType);
  const label = !flew ? "Failed" : isSc ? (procedureName ?? contractName ?? "Contract call") : isIn ? "Received" : "Sent";
  const labelColor = !flew ? "var(--color-status-error)" : isIn ? "var(--color-accent)" : "var(--color-text-secondary)";
  const address = isSc
    ? (contractName ?? fromContract ?? truncateId(isIn ? (tx.source ?? "Unknown") : (tx.destination ?? "Unknown")))
    : truncateId(isIn ? (tx.source ?? "Unknown") : (tx.destination ?? "Unknown"));
  const txType = !flew ? "failed" as const : isSc ? "sc" as const : isIn ? "received" as const : "sent" as const;
  const counterparty = isIn ? tx.source : tx.destination;

  return (
    <ActivityItem
      className="stagger-item"
      onClick={() => onSelect(tx.hash)}
      label={label}
      labelColor={labelColor}
      address={address}
      time={formatClock(tx.timestamp) || `Tick ${tx.tickNumber}`}
      amount={hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount)}`}
      amountColor={flew ? (isIn ? "var(--color-accent)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
      txType={txType}
      leading={<RowLeading contractName={contractName ?? fromContract} identity={counterparty} />}
    />
  );
}
