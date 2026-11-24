import { useNavigate, useParams } from "react-router";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ShieldAlertIcon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { usePersistedStore, type PendingTx } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTickInfo } from "@/hooks/use-tick-info";
import { type TxHistoryItem } from "@/hooks/use-tx-history";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { formatPreferredCurrencyFromQu } from "@/lib/format";
import { findClosestPriceSnapshot } from "@/lib/history-analytics";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { isPendingTx } from "./tx-detail-helpers";
import { PendingTxDetail } from "./tx-detail-pending";
import { ConfirmedTxDetail } from "./tx-detail-confirmed";

export default function TxDetailScreen() {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const settings = usePersistedStore((s) => s.settings);
  const vaults = usePersistedStore((s) => s.vaults);
  const wallets = useSessionStore((s) => s.wallets);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const txMemos = usePersistedStore((s) => s.txMemos);
  const setTxMemo = usePersistedStore((s) => s.setTxMemo);
  const deleteTxMemo = usePersistedStore((s) => s.deleteTxMemo);
  const priceSnapshots = usePersistedStore((s) => s.priceSnapshots);
  const hideBalances = settings.hideBalances;
  const quote = usePreferredCurrencyQuote();

  const vault = vaults.find((v) => v.id === settings.activeVaultId) ?? vaults[0] ?? null;
  const identity = getVaultAccountIdentity(vault, settings.activeAccountIndex, wallets);

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
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-12) 0", gap: "var(--space-3)" }}>
          <ShieldAlertIcon size={32} style={{ color: "var(--color-text-disabled)" }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-disabled)" }}>
            Transaction not found
          </span>
          <Button variant="secondary" shape="sharp" size="sm" onClick={() => navigate("/history")}>Back to history</Button>
        </div>
      </AppShell>
    );
  }

  const snapshot = findClosestPriceSnapshot(isPendingTx(detail) ? detail.broadcastAt : detail.timestamp, priceSnapshots);
  const fiatValue = snapshot ? formatPreferredCurrencyFromQu(detail.amount ?? "0", { usdPrice: snapshot.priceUsd, ...quote }).text : "—";

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
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
    </AppShell>
  );
}
