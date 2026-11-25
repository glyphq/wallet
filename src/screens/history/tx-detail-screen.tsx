import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { ArrowUpRight01Icon, CheckmarkCircle01Icon, Copy01Icon } from "@/lib/icons";
import { explorerTransactionUrl, openExplorer } from "@/lib/explorer";
import { copyToClipboard } from "@/lib/clipboard";
import { usePersistedStore, type PendingTx } from "@/store/persisted";
import { useTickInfo } from "@/hooks/use-tick-info";
import { type TxHistoryItem } from "@/hooks/use-tx-history";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { formatPreferredCurrencyFromQu } from "@/lib/format";
import { findClosestPriceSnapshot } from "@/lib/price-snapshots";
import { isPendingTx } from "./tx-detail-helpers";
import { PendingTxDetail } from "./tx-detail-pending";
import { ConfirmedTxDetail } from "./tx-detail-confirmed";

export default function TxDetailScreen() {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const settings = usePersistedStore((s) => s.settings);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const txMemos = usePersistedStore((s) => s.txMemos);
  const setTxMemo = usePersistedStore((s) => s.setTxMemo);
  const deleteTxMemo = usePersistedStore((s) => s.deleteTxMemo);
  const priceSnapshots = usePersistedStore((s) => s.priceSnapshots);
  const hideBalances = settings.hideBalances;
  const quote = usePreferredCurrencyQuote();

  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  // Look up the tx: check pending first, then history cache
  const pending = hash ? pendingTxs.find((p) => p.hash === hash) : undefined;
  const historyTx = hash && !pending
    ? (queryClient.getQueriesData<InfiniteData<{ items: TxHistoryItem[]; nextCursor: string | null }>>({ queryKey: ["tx-history"] })
        .flatMap(([, data]) => data?.pages?.flatMap((page) => page.items) ?? [])
        .find((tx) => tx.hash === hash))
    : undefined;

  const detail: TxHistoryItem | PendingTx | undefined = pending ?? historyTx;

  if (!detail || !hash) {
    return (
      <AppShell fullBleed contentStyle={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-3)", padding: "var(--space-4)" }}>
          <EmptyCollectionState
            icon="search"
            title="Transaction not found"
            description="This transaction is not in the loaded history for the active account."
          />
          <Button variant="secondary" size="sm" style={{ width: "auto" }} onClick={() => navigate("/history")}>
            Back to history
          </Button>
        </div>
      </AppShell>
    );
  }

  const snapshot = findClosestPriceSnapshot(isPendingTx(detail) ? detail.broadcastAt : detail.timestamp, priceSnapshots);
  const fiatValue = snapshot ? formatPreferredCurrencyFromQu(detail.amount ?? "0", { usdPrice: snapshot.priceUsd, ...quote }).text : "—";

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", width: "100%", maxWidth: 600, padding: "var(--space-5)" }}>
      {isPendingTx(detail) ? (
        <PendingTxDetail
          tx={detail}
          hash={hash}
          currentTick={currentTick}
          hideBalances={hideBalances}
          snapshot={snapshot}
          fiatValue={fiatValue}
        />
      ) : (
        <ConfirmedTxDetail
          tx={detail}
          hash={hash}
          hideBalances={hideBalances}
          snapshot={snapshot}
          fiatValue={fiatValue}
          memo={txMemos[hash] ?? ""}
          onSaveMemo={(next) => {
            if (next) setTxMemo(hash, next);
            else deleteTxMemo(hash);
          }}
        />
      )}
      </div>

      <footer style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--space-5) var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", width: "100%", maxWidth: 600 }}>
          <Button style={{ flex: 1 }} onClick={() => openExplorer(explorerTransactionUrl(hash))}>
            Open in Explorer
            <ArrowUpRight01Icon size={16} strokeWidth={2} aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            aria-label={copied ? "Transaction ID copied" : "Copy transaction ID"}
            title={copied ? "Copied" : "Copy transaction ID"}
            style={{ width: 52, padding: 0, flexShrink: 0 }}
            onClick={() => {
              void copyToClipboard(hash).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? (
              <CheckmarkCircle01Icon size={18} color="var(--color-status-success)" aria-hidden="true" />
            ) : (
              <Copy01Icon size={18} aria-hidden="true" />
            )}
          </Button>
        </div>
      </footer>
    </AppShell>
  );
}
