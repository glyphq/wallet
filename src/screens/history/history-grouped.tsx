import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatQuCompact, formatDate, formatPreferredCurrencyFromQu, truncateId } from "@/lib/format";
import { findClosestPriceSnapshot } from "@/lib/history-analytics";
import type { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import type { TxHistoryItem } from "@/hooks/use-tx-history";
import type { AppSettings, PriceSnapshot } from "@/store/persisted";
import { ActivityItem } from "./history-activity-item";

export function GroupedTxs({
  txs, identity, settings, priceSnapshots, quote, onSelect,
}: {
  txs: TxHistoryItem[];
  identity: string | null;
  settings: AppSettings;
  priceSnapshots: PriceSnapshot[];
  quote: ReturnType<typeof usePreferredCurrencyQuote>;
  onSelect: (tx: TxHistoryItem) => void;
}) {
  const groups = new Map<string, { label: string; txs: TxHistoryItem[]; volume: bigint }>();
  for (const tx of txs) {
    const isIn = tx.destination === identity;
    const key = (isIn ? tx.source : tx.destination) ?? "unknown";
    const label = KNOWN_CONTRACT_ADDRESSES[key] ?? truncateId(key, 10, 8);
    const existing = groups.get(key) ?? { label, txs: [], volume: 0n };
    existing.txs.push(tx);
    try { existing.volume += BigInt(tx.amount ?? "0"); } catch { /* ignore */ }
    groups.set(key, existing);
  }
  const sorted = [...groups.entries()].sort((a, b) => (a[1].volume > b[1].volume ? -1 : 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {sorted.map(([key, group]) => (
        <div key={key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border-subtle)", marginBottom: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{group.label}</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{group.txs.length} tx · {formatQuCompact(group.volume)} QU</span>
          </div>
          {group.txs.map((tx) => {
            const isIn = tx.destination === identity;
            const flew = tx.moneyFlew;
            const snapshot = findClosestPriceSnapshot(tx.timestamp, priceSnapshots);
            const label = !flew ? "Failed" : isIn ? "Received" : "Sent";
            const labelColor = !flew ? "var(--color-status-error)" : isIn ? "var(--color-accent)" : "var(--color-text-secondary)";
            return (
              <ActivityItem
                key={tx.hash}
                className="stagger-item"
                onClick={() => onSelect(tx)}
                label={label}
                labelColor={labelColor}
                address={formatDate(tx.timestamp) || `Tick ${tx.tickNumber}`}
                time=""
                amount={settings.hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount)}`}
                amountUsd={settings.hideBalances || !snapshot ? undefined : formatPreferredCurrencyFromQu(tx.amount, { usdPrice: snapshot.priceUsd, ...quote }).text}
                amountColor={flew ? (isIn ? "var(--color-accent)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
                txType={!flew ? "failed" : isIn ? "received" : "sent"}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
