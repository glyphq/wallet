import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { AsciiReveal } from "ascii-reveal";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useTickInfo } from "@/hooks/use-tick-info";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { StatusText } from "./history-ui";
import { HistoryToolbar } from "./history-toolbar";
import { HistoryTxList } from "./history-tx-list";
import {
  HistoryEmptyState,
  HistoryLoadMore,
  HistoryLoadingMoreRows,
} from "./history-list-states";
import { HistorySkeletonRows } from "./history-skeleton";

const INITIAL_VISIBLE_HISTORY_ROWS = 150;
const HISTORY_RENDER_PAGE = 100;

export default function HistoryScreen() {
  const navigate = useNavigate();
  const settings = usePersistedStore((s) => s.settings);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const accounts = useSessionStore((s) => s.accounts);
  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === s.settings.activeWalletId));
  const identity = getWalletAccountIdentity(wallet ?? null, settings.activeAccountIndex, accounts);

  const [visibleConfirmedCount, setVisibleConfirmedCount] = useState(INITIAL_VISIBLE_HISTORY_ROWS);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTxHistory(identity);
  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  useEffect(() => {
    setVisibleConfirmedCount(INITIAL_VISIBLE_HISTORY_ROWS);
  }, [identity]);

  const allTxs = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const initialLoading = isLoading && allTxs.length === 0;
  const fetchedHashes = useMemo(() => new Set(allTxs.map((tx) => tx.hash)), [allTxs]);
  const myPending = useMemo(
    () => pendingTxs.filter((tx) => tx.source === identity || tx.destination === identity),
    [identity, pendingTxs],
  );
  const visiblePending = useMemo(
    () => myPending.filter((tx) => !fetchedHashes.has(tx.hash)),
    [fetchedHashes, myPending],
  );

  const visibleConfirmedTxs = useMemo(
    () => allTxs.slice(0, visibleConfirmedCount),
    [allTxs, visibleConfirmedCount],
  );
  const hasHiddenLoadedTxs = allTxs.length > visibleConfirmedCount;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasHiddenLoadedTxs || !hasNextPage || isFetchingNextPage) return;
        fetchNextPage();
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasHiddenLoadedTxs, hasNextPage, isFetchingNextPage, fetchNextPage]);

  function showOlderLoadedTxs() {
    setVisibleConfirmedCount((count) => Math.min(allTxs.length, count + HISTORY_RENDER_PAGE));
  }

  return (
    <AppShell
      fullBleed
      statusBar={<HistoryToolbar identity={identity} />}
      contentStyle={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, padding: 0 }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)", display: "flex", flexDirection: "column" }}>
        <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", flex: 1 }}>
          <AsciiReveal
            loading={initialLoading}
            revealOnMount={false}
            shimmer={false}
            duration="fast"
            style={{ display: "flex", flexDirection: "column", flex: 1 }}
          >
            {initialLoading ? (
              <HistorySkeletonRows />
            ) : (
              <>
                {isError ? <StatusText color="var(--color-status-error)">Network error</StatusText> : null}
                {!isError && visiblePending.length === 0 && allTxs.length === 0 ? <HistoryEmptyState /> : null}

                {!isError ? (
                  <HistoryTxList
                    pending={visiblePending}
                    txs={visibleConfirmedTxs}
                    identity={identity}
                    currentTick={currentTick}
                    hideBalances={settings.hideBalances}
                    onSelect={(hash) => navigate(`/tx/${hash}`)}
                  />
                ) : null}

                {!isError && hasHiddenLoadedTxs ? (
                  <HistoryLoadMore
                    visibleCount={visibleConfirmedTxs.length}
                    totalCount={allTxs.length}
                    onShowOlder={showOlderLoadedTxs}
                  />
                ) : null}
              </>
            )}

            <div ref={sentinelRef} style={{ height: 1 }} />
            {isFetchingNextPage ? <HistoryLoadingMoreRows /> : null}
            {!hasHiddenLoadedTxs && !hasNextPage && allTxs.length > 0 ? (
              <StatusText color="var(--color-text-disabled)">End</StatusText>
            ) : null}
          </AsciiReveal>
        </div>
      </div>
    </AppShell>
  );
}
