import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { Download01Icon, FilterIcon, RefreshIcon, ChartLineData01Icon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellVaultSwitcher } from "@/components/shell-vault-switcher";
import { Sheet } from "@/components/sheet";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import { usePersistedStore, type PendingTx } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useTickInfo } from "@/hooks/use-tick-info";
import { KNOWN_CONTRACT_ADDRESSES, resolveProcedureName } from "@/lib/contracts";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { truncateId, formatQuCompact, formatDate, formatPreferredCurrencyFromQu } from "@/lib/format";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { findClosestPriceSnapshot } from "@/lib/history-analytics";
import {
  DEFAULT_FILTERS,
  HISTORY_RENDER_PAGE,
  INITIAL_VISIBLE_HISTORY_ROWS,
  downloadText,
  exportRecordFromPending,
  exportRecordFromTx,
  groupTxsByDate,
  isDefault,
  matchesPendingFilters,
  sanitize,
  toCsv,
  toDraft,
  type DraftInputs,
  type TxFilters,
} from "./history-utils";
import {
  ActiveChip,
  APPLY_BTN,
  ExportAction,
  FILTER_FOOTER,
  FILTER_SHEET_BODY,
  FILTER_SIDEBAR,
  FilterHeader,
  FilterSection,
  GHOST_BTN,
  HistoryFilterControls,
  INPUT_SM,
  StatusText,
} from "./history-ui";
import { ActivityItem } from "./history-activity-item";
import { GroupedTxs } from "./history-grouped";

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const navigate = useNavigate();
  const settings = usePersistedStore((s) => s.settings);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const wallets = useSessionStore((s) => s.wallets);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const identity = getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets);

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
  const [memoDateFrom, setMemoDateFrom] = useState("");
  const [memoDateTo, setMemoDateTo] = useState("");
  const [memoMinAmount, setMemoMinAmount] = useState("");
  const [visibleConfirmedCount, setVisibleConfirmedCount] = useState(INITIAL_VISIBLE_HISTORY_ROWS);

  function exportMemos() {
    let entries = Object.entries(txMemos).filter(([, v]) => v.trim());
    // Apply date and amount filters by matching against allTxs
    if (memoDateFrom || memoDateTo || memoMinAmount) {
      const from = memoDateFrom ? new Date(memoDateFrom).getTime() : 0;
      const to = memoDateTo ? new Date(memoDateTo).getTime() + 86400000 : Infinity;
      const minAmt = memoMinAmount ? BigInt(memoMinAmount) : 0n;
      const txMap = new Map(allTxs.map((tx) => [tx.hash, tx]));
      entries = entries.filter(([hash]) => {
        const tx = txMap.get(hash);
        if (!tx) return true;
        if (tx.timestamp && (tx.timestamp < from || tx.timestamp > to)) return false;
        try { if (BigInt(tx.amount ?? "0") < minAmt) return false; } catch { /* ignore */ }
        return true;
      });
    }
    if (!entries.length) return;
    downloadText(`glyph-memos-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(Object.fromEntries(entries), null, 2), "application/json");
    setMemoExportOpen(false);
  }

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

  const allTxs = useMemo(() => data?.pages.flat() ?? [], [data]);
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
  const isExpired = (p: PendingTx) => currentTick > 0 && currentTick > p.targetTick;
  const exportRows = useMemo(
    () => [
      ...filteredPending.map((p) => exportRecordFromPending(p, identity, txMemos, txTags, isExpired(p))),
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
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.direction !== "all") chips.push({ label: filters.direction === "in" ? "Incoming" : "Outgoing", clear: () => setFilters((f) => ({ ...f, direction: "all" })) });
  if (filters.type !== "all") chips.push({ label: filters.type === "sc" ? "SC calls" : "Transfers", clear: () => setFilters((f) => ({ ...f, type: "all" })) });
  if (filters.minAmount || filters.maxAmount) {
    const label = filters.minAmount && filters.maxAmount
      ? `${formatQuCompact(filters.minAmount)}–${formatQuCompact(filters.maxAmount)} QU`
      : filters.minAmount ? `≥ ${formatQuCompact(filters.minAmount)} QU` : `≤ ${formatQuCompact(filters.maxAmount)} QU`;
    chips.push({ label, clear: () => { setFilters((f) => ({ ...f, minAmount: "", maxAmount: "" })); setDraft((d) => ({ ...d, minAmount: "", maxAmount: "" })); } });
  }
  if (filters.dateFrom || filters.dateTo) {
    const label = filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom} – ${filters.dateTo}`
      : filters.dateFrom ? `From ${filters.dateFrom}` : `To ${filters.dateTo}`;
    chips.push({ label, clear: () => { setFilters((f) => ({ ...f, dateFrom: "", dateTo: "" })); setDraft((d) => ({ ...d, dateFrom: "", dateTo: "" })); } });
  }
  if (filters.tickFrom || filters.tickTo) {
    const label = filters.tickFrom && filters.tickTo
      ? `Tick ${filters.tickFrom}–${filters.tickTo}`
      : filters.tickFrom ? `Tick ≥${filters.tickFrom}` : `Tick ≤${filters.tickTo}`;
    chips.push({ label, clear: () => { setFilters((f) => ({ ...f, tickFrom: "", tickTo: "" })); setDraft((d) => ({ ...d, tickFrom: "", tickTo: "" })); } });
  }
  if (groupByCounterparty) chips.push({ label: "Grouped", clear: () => setGroupByCounterparty(false) });

  const historyHeader = useMemo(() => (
    <ScreenHeader
      leading={<ShellVaultSwitcher />}
      title="History"
      action={
        <>
          <IconButton label="View analytics" onClick={() => navigate("/analytics")}>
            <ChartLineData01Icon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label="Export history" onClick={() => setExportOpen(true)} disabled={!exportRows.length}>
            <Download01Icon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label={hasActive ? "Filter history, filters active" : "Filter history"} onClick={() => setFilterOpen(true)}>
            <FilterIcon size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label="RefreshIcon history" onClick={() => void refetch()}>
            <RefreshIcon size={20} aria-hidden="true" />
          </IconButton>
        </>
      }
    />
  ), [exportRows.length, hasActive, navigate, refetch]);

  return (
    <AppShell
      fullBleed
      statusBar={historyHeader}
      contentStyle={{ display: "flex", flexDirection: "row", overflow: "hidden", flex: 1, padding: 0 }}
    >
      {/* ── Wide-screen sticky filter sidebar ── */}
      {wideLayout && (
        <aside style={FILTER_SIDEBAR} aria-label="History filters">
          <FilterHeader
            title="FilterIcon"
            active={hasActive}
            onReset={() => { setFilters(DEFAULT_FILTERS); setDraft(toDraft(DEFAULT_FILTERS)); }}
          />
          <HistoryFilterControls
            filters={filters}
            draft={draft}
            groupByCounterparty={groupByCounterparty}
            commitOnFieldBlur
            setFilters={setFilters}
            setDraft={setDraft}
            setGroupByCounterparty={setGroupByCounterparty}
          />
        </aside>
      )}

      {/* ── Main content column ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)", display: "flex", flexDirection: "column" }}>

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
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4) 0" }}>
          {[120, 180, 140, 160].map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="skeleton" style={{ width: w, height: 16 }} />
                <div className="skeleton" style={{ width: 100, height: 12 }} />
              </div>
              <div className="skeleton" style={{ width: 80, height: 16 }} />
            </div>
          ))}
        </div>
      )}
      {isError && <StatusText color="var(--color-status-error)">Network error</StatusText>}
      {!isLoading && !isError && filteredPending.length === 0 && filteredTxs.length === 0 && (
        allTxs.length === 0 && visiblePending.length === 0 ? (
          <div style={{ textAlign: "center", padding: "var(--space-12) 0" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)", marginBottom: "var(--space-3)" }}>
              No transactions yet
            </div>
          </div>
        ) : (
          <StatusText color="var(--color-text-disabled)">No results</StatusText>
        )
      )}

      {/* Transaction rows */}
      {!isLoading && !isError && groupByCounterparty && filteredTxs.length > 0 && (
        <GroupedTxs txs={visibleConfirmedTxs} identity={identity} settings={settings} priceSnapshots={priceSnapshots} quote={quote} onSelect={(tx) => navigate(`/tx/${tx.hash}`)} />
      )}
      {!isLoading && !isError && !groupByCounterparty && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filteredPending.map((p) => {
            const isIn = p.destination === identity;
            const expired = isExpired(p);
            const pendingSnapshot = findClosestPriceSnapshot(p.broadcastAt, priceSnapshots);
            const label = expired ? "Failed" : "Pending";
            const labelColor = expired ? "var(--color-status-error)" : "var(--color-status-warning)";
            const address = p.contractName ?? (isIn ? truncateId(p.source) : truncateId(p.destination));
            const time = expired
              ? `Expired at tick ${p.targetTick}`
              : currentTick > 0
                ? `ETA ~${Math.max(1, p.targetTick - currentTick)}s`
                : `Target tick ${p.targetTick}`;
            return (
              <ActivityItem
                key={`p-${p.hash}`}
                className="stagger-item"
                onClick={() => navigate(`/tx/${p.hash}`)}
                label={label}
                labelColor={labelColor}
                address={address}
                time={time}
                amount={settings.hideBalances ? "••••••" : `−${formatQuCompact(p.amount)}`}
                amountUsd={settings.hideBalances || !pendingSnapshot ? undefined : formatPreferredCurrencyFromQu(p.amount, { usdPrice: pendingSnapshot.priceUsd, ...quote }).text}
                amountColor={expired ? "var(--color-text-disabled)" : "var(--color-status-warning)"}
                txType={expired ? "failed" : "pending"}
              />
            );
          })}

          {visibleSections.map((section) => (
            <div key={section.label}>
              <div style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-label)",
                fontWeight: 500,
                color: "var(--color-text-disabled)",
                letterSpacing: "0.05em",
                padding: "var(--space-3) 0 var(--space-2)",
              }}>
                {section.label}
              </div>
              {section.txs.map((tx) => {
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
                    key={tx.hash}
                    className={`stagger-item${pendingHashes.has(tx.hash) ? " flash-success" : ""}`}
                    onClick={() => navigate(`/tx/${tx.hash}`)}
                    label={label}
                    labelColor={labelColor}
                    address={address}
                    time={formatDate(tx.timestamp) || `Tick ${tx.tickNumber}`}
                    amount={settings.hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount)}`}
                    amountUsd={settings.hideBalances || !snapshot ? undefined : formatPreferredCurrencyFromQu(tx.amount, { usdPrice: snapshot.priceUsd, ...quote }).text}
                    amountColor={flew ? (isIn ? "var(--color-accent)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
                    txType={txType}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && hasHiddenLoadedTxs && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-5) 0" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>
            Showing {visibleConfirmedTxs.length} of {filteredTxs.length} loaded transactions
          </div>
          <Button variant="secondary" shape="sharp" size="sm" onClick={showOlderLoadedTxs}>
            Show older activity
          </Button>
        </div>
      )}

      {/* Infinite scroll */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4) 0" }}>
          {[140, 160, 120].map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="skeleton" style={{ width: w, height: 16 }} />
                <div className="skeleton" style={{ width: 100, height: 12 }} />
              </div>
              <div className="skeleton" style={{ width: 80, height: 16 }} />
            </div>
          ))}
        </div>
      )}
      {!hasHiddenLoadedTxs && !hasNextPage && allTxs.length > 0 && <StatusText color="var(--color-text-disabled)">End</StatusText>}

      </motion.div>
      </div>{/* end main content column */}

      {/* ── Filter sheet ────────────────────────────────────────────────────── */}
      <Sheet
        open={filterOpen}
        onClose={applyAndClose}
        title="Filter history"
        footer={
          <div style={FILTER_FOOTER}>
            {hasActive ? (
              <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setDraft(toDraft(DEFAULT_FILTERS)); setFilterOpen(false); }} style={GHOST_BTN}>
                Reset all
              </button>
            ) : <span />}
            <button type="button" onClick={applyAndClose} style={APPLY_BTN}>Apply</button>
          </div>
        }
      >
        <div style={FILTER_SHEET_BODY}>
          <HistoryFilterControls
            filters={filters}
            draft={draft}
            groupByCounterparty={groupByCounterparty}
            setFilters={setFilters}
            setDraft={setDraft}
            setGroupByCounterparty={setGroupByCounterparty}
          />
        </div>
      </Sheet>

      <Sheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export history"
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ExportAction label="CSV" detail={`${exportRows.length} records`} onClick={() => exportHistory("csv")} />
          <ExportAction label="JSON" detail={`${exportRows.length} records`} onClick={() => exportHistory("json")} />
          {hasMemos && <ExportAction label="Memos" detail="JSON" onClick={() => { setExportOpen(false); setMemoExportOpen(true); }} />}
        </div>
      </Sheet>

      {/* Memo export filter sheet */}
      <Sheet
        open={memoExportOpen}
        onClose={() => setMemoExportOpen(false)}
        title="Export memos"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button type="button" onClick={() => { setMemoDateFrom(""); setMemoDateTo(""); setMemoMinAmount(""); }} style={GHOST_BTN}>Reset</button>
            <button type="button" onClick={exportMemos} style={APPLY_BTN}>Export JSON</button>
          </div>
        }
      >
        <FilterSection label="Date range">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%" }}>
            <Input type="date" value={memoDateFrom} onChange={(e) => setMemoDateFrom(e.target.value)} style={INPUT_SM} containerStyle={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", flexShrink: 0 }}>–</span>
            <Input type="date" value={memoDateTo} onChange={(e) => setMemoDateTo(e.target.value)} style={INPUT_SM} containerStyle={{ flex: 1 }} />
          </div>
        </FilterSection>
        <FilterSection label="Min amount (QU)">
          <Input value={memoMinAmount} onChange={(e) => setMemoMinAmount(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" style={INPUT_SM} containerStyle={{ width: "100%" }} />
        </FilterSection>
      </Sheet>
    </AppShell>
  );
}
