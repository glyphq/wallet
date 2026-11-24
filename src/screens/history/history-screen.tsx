import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useTickInfo } from "@/hooks/use-tick-info";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { getWalletAccountIdentity } from "@/lib/accounts";
import {
  DEFAULT_FILTERS,
  HISTORY_RENDER_PAGE,
  INITIAL_VISIBLE_HISTORY_ROWS,
  downloadText,
  exportRecordFromPending,
  exportRecordFromTx,
  groupTxsByDate,
  isDefault,
  isPendingTxExpired,
  matchesPendingFilters,
  sanitize,
  toCsv,
  toDraft,
  type DraftInputs,
  type TxFilters,
} from "./history-utils";
import { ActiveChip, StatusText } from "./history-ui";
import { buildActiveFilterChips } from "./history-active-filters";
import { HistoryFilterSidebar } from "./history-filter-sidebar";
import { HistoryToolbar } from "./history-toolbar";
import { GroupedTxs } from "./history-grouped";
import { HistoryTxList } from "./history-tx-list";
import {
  HistoryEmptyState,
  HistoryLoadMore,
  HistoryLoadingMoreRows,
  HistoryLoadingRows,
} from "./history-list-states";
import { HistoryFilterSheet } from "./history-filter-sheet";
import { HistoryExportSheet } from "./history-export-sheet";
import { HistoryMemoExportSheet } from "./history-memo-export-sheet";

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const navigate = useNavigate();
  const settings = usePersistedStore((s) => s.settings);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const accounts = useSessionStore((s) => s.accounts);
  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === s.settings.activeWalletId));
  const identity = getWalletAccountIdentity(wallet ?? null, settings.activeAccountIndex, accounts);

  const txMemos = usePersistedStore((s) => s.txMemos);
  const txTags = usePersistedStore((s) => s.txTags);
  const priceSnapshots = usePersistedStore((s) => s.priceSnapshots);

  const quote = usePreferredCurrencyQuote();

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const wideLayout = windowWidth >= 720;

  const [filters, setFilters] = useState<TxFilters>(DEFAULT_FILTERS);
  const [groupByCounterparty, setGroupByCounterparty] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState<DraftInputs>(toDraft(DEFAULT_FILTERS));
  const [exportOpen, setExportOpen] = useState(false);
  const [memoExportOpen, setMemoExportOpen] = useState(false);
  const [visibleConfirmedCount, setVisibleConfirmedCount] = useState(INITIAL_VISIBLE_HISTORY_ROWS);

  const hasMemos = Object.values(txMemos).some((v) => v.trim());
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTxHistory(identity, filters);
  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  // Keep filters when the identity changes so the user retains their current context.

  // Sync draft when sheet opens so edits start from current values
  useEffect(() => { if (filterOpen) setDraft(toDraft(filters)); }, [filterOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setVisibleConfirmedCount(INITIAL_VISIBLE_HISTORY_ROWS);
  }, [identity, filters.direction, filters.type, filters.minAmount, filters.maxAmount, filters.dateFrom, filters.dateTo, filters.tickFrom, filters.tickTo, groupByCounterparty]);

  function applyAndClose() {
    setFilters((f) => ({
      ...f,
      minAmount: sanitize(draft.minAmount),
      maxAmount: sanitize(draft.maxAmount),
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      tickFrom: sanitize(draft.tickFrom),
      tickTo: sanitize(draft.tickTo),
    }));
    setFilterOpen(false);
  }

  function resetAndClose() {
    setFilters(DEFAULT_FILTERS);
    setDraft(toDraft(DEFAULT_FILTERS));
    setFilterOpen(false);
  }

  const allTxs = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const fetchedHashes = useMemo(() => new Set(allTxs.map((t) => t.hash)), [allTxs]);
  const myPending = useMemo(
    () => pendingTxs.filter((p) => p.source === identity || p.destination === identity),
    [identity, pendingTxs],
  );
  const visiblePending = useMemo(
    () => myPending.filter((p) => !fetchedHashes.has(p.hash)),
    [fetchedHashes, myPending],
  );

  const filteredPending = useMemo(
    () => visiblePending.filter((p) => matchesPendingFilters(p, filters, identity)),
    [filters, identity, visiblePending],
  );

  const filteredTxs = allTxs;
  const pendingHashes = useMemo(() => new Set(pendingTxs.map((p) => p.hash)), [pendingTxs]);
  const visibleConfirmedTxs = useMemo(
    () => filteredTxs.slice(0, visibleConfirmedCount),
    [filteredTxs, visibleConfirmedCount],
  );
  const visibleSections = useMemo(
    () => groupTxsByDate(visibleConfirmedTxs),
    [visibleConfirmedTxs],
  );
  const hasHiddenLoadedTxs = filteredTxs.length > visibleConfirmedCount;
  const hasActive = !isDefault(filters);
  const exportRows = useMemo(
    () => [
      ...filteredPending.map((p) => exportRecordFromPending(p, identity, txMemos, txTags, isPendingTxExpired(p, currentTick))),
      ...filteredTxs.map((tx) => exportRecordFromTx(tx, identity, txMemos, txTags)),
    ],
    [filteredPending, filteredTxs, identity, txMemos, txTags, currentTick], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function exportHistory(format: "csv" | "json") {
    if (!exportRows.length) return;
    const date = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      downloadText(`glyph-history-${date}.csv`, toCsv(exportRows), "text/csv;charset=utf-8");
    } else {
      downloadText(`glyph-history-${date}.json`, JSON.stringify({ filters, transactions: exportRows }, null, 2), "application/json");
    }
    setExportOpen(false);
  }

  // Infinite scroll sentinel
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
    setVisibleConfirmedCount((count) => Math.min(filteredTxs.length, count + HISTORY_RENDER_PAGE));
  }

  // ── Active filter chips ───────────────────────────────────────────────────
  const chips = buildActiveFilterChips(filters, groupByCounterparty).map((chip) => ({
    label: chip.label,
    clear: () => {
      if (chip.filters) setFilters((f) => ({ ...f, ...chip.filters }));
      if (chip.draft) setDraft((d) => ({ ...d, ...chip.draft }));
      if (chip.clearGrouping) setGroupByCounterparty(false);
    },
  }));

  return (
    <AppShell
      fullBleed
      contentStyle={{ display: "flex", flexDirection: "row", overflow: "hidden", flex: 1, padding: 0 }}
    >
      {/* ── Wide-screen sticky filter sidebar ── */}
      {wideLayout && (
        <HistoryFilterSidebar
          active={hasActive}
          filters={filters}
          draft={draft}
          groupByCounterparty={groupByCounterparty}
          setFilters={setFilters}
          setDraft={setDraft}
          setGroupByCounterparty={setGroupByCounterparty}
          onReset={() => { setFilters(DEFAULT_FILTERS); setDraft(toDraft(DEFAULT_FILTERS)); }}
        />
      )}

      {/* ── Main content column ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <section style={{ flexShrink: 0, borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-base)" }}>
          <AsciiBackdrop
            contentStyle={{
              justifyContent: "center",
              alignItems: "stretch",
              padding: "0 var(--screen-padding)",
            }}
          >
            <HistoryToolbar
              exportDisabled={!exportRows.length}
              hasActiveFilters={hasActive}
              onViewAnalytics={() => navigate("/analytics")}
              onExport={() => setExportOpen(true)}
              onFilter={() => setFilterOpen(true)}
              onRefresh={() => void refetch()}
            />
          </AsciiBackdrop>
        </section>

        <div style={{ flex: 1, padding: "var(--space-4)", display: "flex", flexDirection: "column" }}>
      <motion.div
        {...presets.fadeIn}
        style={{ display: "flex", flexDirection: "column", flex: 1 }}
      >

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          {chips.map((c) => <ActiveChip key={c.label} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      {/* States */}
      {isLoading && <HistoryLoadingRows />}
      {isError && <StatusText color="var(--color-status-error)">Network error</StatusText>}
      {!isLoading && !isError && filteredPending.length === 0 && filteredTxs.length === 0 && (
        <HistoryEmptyState hasAnyActivity={allTxs.length === 0 && visiblePending.length === 0} />
      )}

      {/* Transaction rows */}
      {!isLoading && !isError && groupByCounterparty && filteredTxs.length > 0 && (
        <GroupedTxs txs={visibleConfirmedTxs} identity={identity} settings={settings} priceSnapshots={priceSnapshots} quote={quote} onSelect={(tx) => navigate(`/tx/${tx.hash}`)} />
      )}
      {!isLoading && !isError && !groupByCounterparty && (
        <HistoryTxList
          pending={filteredPending}
          sections={visibleSections}
          identity={identity}
          currentTick={currentTick}
          hideBalances={settings.hideBalances}
          pendingHashes={pendingHashes}
          priceSnapshots={priceSnapshots}
          quote={quote}
          onSelect={(hash) => navigate(`/tx/${hash}`)}
        />
      )}

      {!isLoading && !isError && hasHiddenLoadedTxs && (
        <HistoryLoadMore
          visibleCount={visibleConfirmedTxs.length}
          totalCount={filteredTxs.length}
          onShowOlder={showOlderLoadedTxs}
        />
      )}

      {/* Infinite scroll */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && <HistoryLoadingMoreRows />}
      {!hasHiddenLoadedTxs && !hasNextPage && allTxs.length > 0 && <StatusText color="var(--color-text-disabled)">End</StatusText>}

      </motion.div>
        </div>
      </div>{/* end main content column */}

      <HistoryFilterSheet
        open={filterOpen}
        active={hasActive}
        filters={filters}
        draft={draft}
        groupByCounterparty={groupByCounterparty}
        setFilters={setFilters}
        setDraft={setDraft}
        setGroupByCounterparty={setGroupByCounterparty}
        onApply={applyAndClose}
        onReset={resetAndClose}
        onClose={applyAndClose}
      />

      <HistoryExportSheet
        open={exportOpen}
        recordCount={exportRows.length}
        hasMemos={hasMemos}
        onExport={exportHistory}
        onExportMemos={() => { setExportOpen(false); setMemoExportOpen(true); }}
        onClose={() => setExportOpen(false)}
      />

      <HistoryMemoExportSheet
        open={memoExportOpen}
        txs={allTxs}
        memos={txMemos}
        onClose={() => setMemoExportOpen(false)}
      />
    </AppShell>
  );
}
