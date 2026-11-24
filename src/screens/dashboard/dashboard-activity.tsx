import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Divider } from "@/components/divider";
import { AsciiEmptyState } from "@/components/ascii-empty-state";
import { usePersistedStore } from "@/store/persisted";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useTxHistory } from "@/hooks/use-tx-history";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { truncateId, formatQuCompact, formatDate, formatPreferredCurrencyFromQu } from "@/lib/format";
import { KNOWN_CONTRACT_ADDRESSES, resolveProcedureName } from "@/lib/contracts";
import { pendingTxProgress } from "@/lib/pending-tx-progress";

function ActivityItem({ onClick, label, labelColor, address, time, amount, amountUsd, amountColor }: {
  onClick: () => void;
  label: string;
  labelColor: string;
  address: string;
  time: string;
  amount: string;
  amountUsd?: string;
  amountColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)",
        width: "100%", background: "none", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: labelColor }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
          {address}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>
          {time}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: amountColor, fontVariantNumeric: "tabular-nums" }}>
          {amount}
        </span>
        {amountUsd && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", fontVariantNumeric: "tabular-nums" }}>
            {amountUsd}
          </span>
        )}
      </div>
    </button>
  );
}

export function RecentTxs({ identity, activeIdentity, hideBalances, price }: {
  identity: string | null;
  activeIdentity: string | null;
  hideBalances: boolean;
  price?: number;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useTxHistory(identity);
  const txs = data?.pages[0]?.items;
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const { data: lastProcessedTickData } = useLastProcessedTick();
  const queryClient = useQueryClient();
  const lastProcessedTick = lastProcessedTickData?.tickNumber ?? 0;
  const quote = usePreferredCurrencyQuote();

  useEffect(() => {
    if (!lastProcessedTick || !identity) return;
    const hasReady = pendingTxs.some(
      (p) => (p.source === identity || p.destination === identity) && lastProcessedTick >= p.targetTick,
    );
    if (hasReady) queryClient.invalidateQueries({ queryKey: ["tx-history"] });
  }, [lastProcessedTick, pendingTxs, identity, queryClient]);

  const myPending = pendingTxs
    .filter((p) => p.source === activeIdentity || p.destination === activeIdentity)
    .slice(0, 3);
  const recent = (txs ?? []).slice(0, 5 - Math.min(myPending.length, 3));
  const hasAny = myPending.length > 0 || recent.length > 0;

  if (isLoading && !hasAny) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-3) 0" }}>
        {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="skeleton" style={{ width: 80, height: 12 }} />
              <div className="skeleton" style={{ width: 120, height: 10 }} />
            </div>
            <div className="skeleton" style={{ width: 64, height: 12 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!hasAny) {
    return (
      <AsciiEmptyState
        title="No activity yet"
        description="Incoming and outgoing transactions will appear here."
      />
    );
  }

  const items: { key: string; node: React.ReactNode }[] = [];

  myPending.forEach((p) => {
    const isIn = p.destination === activeIdentity;
    const progress = pendingTxProgress(p.targetTick, lastProcessedTick);
    const expired = progress.phase === "expired";
    const label = progress.label;
    const labelColor = expired ? "var(--color-status-error)" : "var(--color-status-warning)";
    const amountColor = expired ? "var(--color-text-disabled)" : "var(--color-status-warning)";
    const address = p.contractName ?? truncateId(isIn ? p.source : p.destination);
    items.push({ key: p.hash, node:
      <ActivityItem
        key={p.hash}
        onClick={() => navigate(`/tx/${p.hash}`)}
        label={label}
        labelColor={labelColor}
        address={address}
        time={progress.timingText}
        amount={hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(p.amount ?? "0")} QU`}
        amountColor={amountColor}
      />,
    });
  });

  recent.forEach((tx) => {
    const isIn = tx.destination === activeIdentity;
    const flew = tx.moneyFlew ?? true;
    const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
    const fromContract = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
    const isSc = !!(contractName || fromContract);

    const procedureName = resolveProcedureName(contractName, fromContract, tx.inputType);

    const label = !flew ? "Failed" : isSc ? (procedureName ?? contractName ?? "Contract call") : isIn ? "Received" : "Sent";
    const labelColor = !flew ? "var(--color-status-error)" : isIn ? "var(--color-accent)" : "var(--color-text-secondary)";
    const amountColor = flew
      ? isIn ? "var(--color-accent)" : "var(--color-text-display)"
      : "var(--color-text-disabled)";
    const amount = hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount ?? "0")} QU`;
    const amountUsd = !hideBalances && price ? formatPreferredCurrencyFromQu(tx.amount ?? "0", { usdPrice: price, ...quote }).text : undefined;
    const address = isSc
      ? (contractName ?? fromContract ?? truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—")))
      : truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—"));
    items.push({ key: tx.hash, node:
      <ActivityItem
        key={tx.hash}
        onClick={() => navigate(`/tx/${tx.hash}`)}
        label={label}
        labelColor={labelColor}
        address={address}
        time={formatDate(tx.timestamp) || `Tick ${tx.tickNumber}`}
        amount={amount}
        amountUsd={amountUsd}
        amountColor={amountColor}
      />,
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, i) => (
        <div key={item.key} className="stagger-item">
          {i > 0 && <Divider />}
          {item.node}
        </div>
      ))}
    </div>
  );
}
