import { KNOWN_CONTRACT_ADDRESSES, resolveProcedureName } from "@/lib/contracts";
import { truncateId, formatQuCompact, formatDate, formatPreferredCurrencyFromQu } from "@/lib/format";
import { findClosestPriceSnapshot } from "@/lib/history-analytics";
import type { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { PendingTx, PriceSnapshot } from "@/store/persisted";
import { ActivityItem } from "./history-activity-item";
import type { TxSection } from "./history-utils";
import { pendingTxProgress } from "@/lib/pending-tx-progress";

export function HistoryTxList({
  pending, sections, identity, currentTick, hideBalances, pendingHashes, priceSnapshots, quote, onSelect,
}: {
  pending: PendingTx[];
  sections: TxSection[];
  identity: string | null;
  currentTick: number;
  hideBalances: boolean;
  pendingHashes: Set<string>;
  priceSnapshots: PriceSnapshot[];
  quote: ReturnType<typeof usePreferredCurrencyQuote>;
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
          priceSnapshots={priceSnapshots}
          quote={quote}
          onSelect={onSelect}
        />
      ))}

      {sections.map((section) => (
        <div key={section.label}>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            fontWeight: 500,
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "var(--space-3) 0 var(--space-2)",
          }}>
            {section.label}
          </div>
          {section.txs.map((tx) => (
            <ConfirmedTxRow
              key={tx.hash}
              tx={tx}
              identity={identity}
              hideBalances={hideBalances}
              flash={pendingHashes.has(tx.hash)}
              priceSnapshots={priceSnapshots}
              quote={quote}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PendingTxRow({
  tx, identity, currentTick, hideBalances, priceSnapshots, quote, onSelect,
}: {
  tx: PendingTx;
  identity: string | null;
  currentTick: number;
  hideBalances: boolean;
  priceSnapshots: PriceSnapshot[];
  quote: ReturnType<typeof usePreferredCurrencyQuote>;
  onSelect: (hash: string) => void;
}) {
  const isIn = tx.destination === identity;
  const progress = pendingTxProgress(tx.targetTick, currentTick);
  const expired = progress.phase === "expired";
  const pendingSnapshot = findClosestPriceSnapshot(tx.broadcastAt, priceSnapshots);
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
      amount={hideBalances ? "••••••" : `−${formatQuCompact(tx.amount)}`}
      amountUsd={hideBalances || !pendingSnapshot ? undefined : formatPreferredCurrencyFromQu(tx.amount, { usdPrice: pendingSnapshot.priceUsd, ...quote }).text}
      amountColor={expired ? "var(--color-text-disabled)" : "var(--color-status-warning)"}
      txType={expired ? "failed" : "pending"}
    />
  );
}

function ConfirmedTxRow({
  tx, identity, hideBalances, flash, priceSnapshots, quote, onSelect,
}: {
  tx: TxHistoryItem;
  identity: string | null;
  hideBalances: boolean;
  flash: boolean;
  priceSnapshots: PriceSnapshot[];
  quote: ReturnType<typeof usePreferredCurrencyQuote>;
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
  const snapshot = findClosestPriceSnapshot(tx.timestamp, priceSnapshots);
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
      amountUsd={hideBalances || !snapshot ? undefined : formatPreferredCurrencyFromQu(tx.amount, { usdPrice: snapshot.priceUsd, ...quote }).text}
      amountColor={flew ? (isIn ? "var(--color-accent)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
      txType={txType}
    />
  );
}
