import { useNavigate, useParams } from "react-router";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { usePersistedStore, type PendingTx } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTickInfo } from "@/hooks/use-tick-info";
import { type TxHistoryItem } from "@/hooks/use-tx-history";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { formatPreferredCurrencyFromQu } from "@/lib/format";
import { findClosestPriceSnapshot } from "@/lib/price-snapshots";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { isPendingTx } from "./tx-detail-helpers";
import { PendingTxDetail } from "./tx-detail-pending";
import { ConfirmedTxDetail } from "./tx-detail-confirmed";

export default function TxDetailScreen() {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const settings = usePersistedStore((s) => s.settings);
  const wallets = usePersistedStore((s) => s.wallets);
  const accounts = useSessionStore((s) => s.accounts);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const txMemos = usePersistedStore((s) => s.txMemos);
  const setTxMemo = usePersistedStore((s) => s.setTxMemo);
  const deleteTxMemo = usePersistedStore((s) => s.deleteTxMemo);
  const priceSnapshots = usePersistedStore((s) => s.priceSnapshots);
  const hideBalances = settings.hideBalances;
  const quote = usePreferredCurrencyQuote();

  const wallet = wallets.find((v) => v.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const identity = getWalletAccountIdentity(wallet, settings.activeAccountIndex, accounts);

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
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", width: "100%", maxWidth: 720, margin: "0 auto", padding: "var(--space-4)" }}>
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
          identity={identity}
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
    </AppShell>
  );
}
