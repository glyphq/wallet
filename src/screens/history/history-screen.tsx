import { useState, useEffect, useMemo, useRef, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { Download, Filters, Refresh, Chart, ArrowRightUp, ArrowToDownLeft, Bolt, ShieldWarning, ClockCircle } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellVaultSwitcher } from "@/components/shell-vault-switcher";
import { Sheet } from "@/components/sheet";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import { usePersistedStore, type PendingTx, type AppSettings, type PriceSnapshot } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import {
  useTxHistory,
  type TxHistoryItem,
  type TxQueryFilters,
  DEFAULT_QUERY_FILTERS,
} from "@/hooks/use-tx-history";
import { useTickInfo } from "@/hooks/use-tick-info";
import { KNOWN_CONTRACT_ADDRESSES, CONTRACT_PROCEDURE_NAMES, CONTRACT_NAMES } from "@/lib/contracts";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { truncateId, formatQuCompact, formatDate, formatPreferredCurrencyFromQu } from "@/lib/format";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { findClosestPriceSnapshot } from "@/lib/history-analytics";

// ── Filter types ──────────────────────────────────────────────────────────────

type TxFilters = TxQueryFilters;

const DEFAULT_FILTERS: TxFilters = { ...DEFAULT_QUERY_FILTERS };

const INITIAL_VISIBLE_HISTORY_ROWS = 150;
const HISTORY_RENDER_PAGE = 100;

// Draft state for text inputs, committed on Apply
type DraftInputs = {
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
  tickFrom: string;
  tickTo: string;
};

function toDraft(f: TxFilters): DraftInputs {
  return { minAmount: f.minAmount, maxAmount: f.maxAmount, dateFrom: f.dateFrom, dateTo: f.dateTo, tickFrom: f.tickFrom, tickTo: f.tickTo };
}

function sanitize(s: string): string {
  const n = s.trim();
  return n && /^\d+$/.test(n) && Number(n) > 0 ? n : "";
}

function isDefault(f: TxFilters): boolean {
  return (
    f.direction === "all" && f.type === "all" &&
    !f.minAmount && !f.maxAmount && !f.dateFrom && !f.dateTo && !f.tickFrom && !f.tickTo
  );
}

// ── Date grouping ──────────────────────────────────────────────────────────────

type TxSection = { label: string; txs: TxHistoryItem[] };

type ExportTx = {
  hash: string;
  status: "confirmed" | "pending" | "expired";
  direction: "in" | "out" | "self" | "unknown";
  type: "transfer" | "contract";
  source: string | null;
  destination: string | null;
  amount: string;
  tick: number;
  timestamp: number | null;
  isoDate: string;
  moneyFlew: boolean | null;
  inputType: number | null;
  contractName: string;
  memo: string;
  tags: string[];
};

function groupTxsByDate(txs: TxHistoryItem[]): TxSection[] {
  if (!txs.length) return [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();

  const today: TxHistoryItem[] = [];
  const yesterday: TxHistoryItem[] = [];
  const thisWeek: TxHistoryItem[] = [];
  const earlier: TxHistoryItem[] = [];

  for (const tx of txs) {
    const ts = tx.timestamp ?? 0;
    if (ts >= todayStart) today.push(tx);
    else if (ts >= yesterdayStart) yesterday.push(tx);
    else if (ts >= weekStart) thisWeek.push(tx);
    else earlier.push(tx);
  }

  const sections: TxSection[] = [];
  if (today.length) sections.push({ label: "Today", txs: today });
  if (yesterday.length) sections.push({ label: "Yesterday", txs: yesterday });
  if (thisWeek.length) sections.push({ label: "This week", txs: thisWeek });
  if (earlier.length) sections.push({ label: "Earlier", txs: earlier });
  return sections;
}

function downloadText(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | boolean | null | string[]): string {
  const text = Array.isArray(value) ? value.join(";") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: ExportTx[]): string {
  const headers: (keyof ExportTx)[] = ["hash", "status", "direction", "type", "source", "destination", "amount", "tick", "timestamp", "isoDate", "moneyFlew", "inputType", "contractName", "memo", "tags"];
  return [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
}

function matchesPendingFilters(tx: PendingTx, filters: TxFilters, identity: string | null): boolean {
  if (filters.direction === "in" && tx.destination !== identity) return false;
  if (filters.direction === "out" && tx.source !== identity) return false;
  if (filters.type === "transfer" && tx.contractName) return false;
  if (filters.type === "sc" && !tx.contractName) return false;
  try {
    const amount = BigInt(tx.amount || "0");
    if (filters.minAmount && amount < BigInt(filters.minAmount)) return false;
    if (filters.maxAmount && amount > BigInt(filters.maxAmount)) return false;
  } catch { return false; }
  if (filters.tickFrom && tx.targetTick < Number(filters.tickFrom)) return false;
  if (filters.tickTo && tx.targetTick > Number(filters.tickTo)) return false;
  if (filters.dateFrom && tx.broadcastAt < new Date(`${filters.dateFrom}T00:00:00`).getTime()) return false;
  if (filters.dateTo && tx.broadcastAt > new Date(`${filters.dateTo}T23:59:59.999`).getTime()) return false;
  return true;
}

function txDirection(source: string | null, destination: string | null, identity: string | null): ExportTx["direction"] {
  if (!identity) return "unknown";
  if (source === identity && destination === identity) return "self";
  if (destination === identity) return "in";
  if (source === identity) return "out";
  return "unknown";
}

function exportRecordFromTx(tx: TxHistoryItem, identity: string | null, txMemos: Record<string, string>, txTags: Record<string, string[]>): ExportTx {
  const contractName = tx.contractName ?? (tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined) ?? (tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined) ?? "";
  return {
    hash: tx.hash,
    status: "confirmed",
    direction: txDirection(tx.source, tx.destination, identity),
    type: contractName || (tx.inputType ?? 0) > 0 ? "contract" : "transfer",
    source: tx.source,
    destination: tx.destination,
    amount: tx.amount,
    tick: tx.tickNumber,
    timestamp: tx.timestamp,
    isoDate: tx.timestamp ? new Date(tx.timestamp).toISOString() : "",
    moneyFlew: tx.moneyFlew,
    inputType: tx.inputType,
    contractName,
    memo: txMemos[tx.hash]?.trim() ?? "",
    tags: txTags[tx.hash] ?? [],
  };
}

function exportRecordFromPending(tx: PendingTx, identity: string | null, txMemos: Record<string, string>, txTags: Record<string, string[]>, expired: boolean): ExportTx {
  return {
    hash: tx.hash,
    status: expired ? "expired" : "pending",
    direction: txDirection(tx.source, tx.destination, identity),
    type: tx.contractName ? "contract" : "transfer",
    source: tx.source,
    destination: tx.destination,
    amount: tx.amount,
    tick: tx.targetTick,
    timestamp: tx.broadcastAt,
    isoDate: tx.broadcastAt ? new Date(tx.broadcastAt).toISOString() : "",
    moneyFlew: null,
    inputType: null,
    contractName: tx.contractName ?? "",
    memo: txMemos[tx.hash]?.trim() ?? "",
    tags: txTags[tx.hash] ?? [],
  };
}

// ── Transaction type icon map ───────────────────────────────────────────────────

const TX_TYPE_ICONS: Record<string, typeof ArrowRightUp> = {
  sent: ArrowRightUp,
  received: ArrowToDownLeft,
  sc: Bolt,
  failed: ShieldWarning,
  pending: ClockCircle,
};

// ── Activity item ─────────────────────────────────────────────────────────────

function ActivityItem({ onClick, label, labelColor, address, time, amount, amountUsd, amountColor, className, txType }: {
  onClick: () => void;
  label: string;
  labelColor: string;
  address: string;
  time: string;
  amount: string;
  amountUsd?: string;
  amountColor: string;
  className?: string;
  txType?: "sent" | "received" | "sc" | "failed" | "pending";
}) {
  const TypeIcon = txType ? TX_TYPE_ICONS[txType] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        width: "100%", background: "none", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left",
      }}
    >
      {TypeIcon && (
        <div style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-control)",
          background: "var(--color-bg-surface)",
          color: txType === "failed" ? "var(--color-status-warning)" : txType === "pending" ? "var(--color-text-disabled)" : "var(--color-text-secondary)",
        }}>
          <TypeIcon size={20} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
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
            <Chart size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label="Export history" onClick={() => setExportOpen(true)} disabled={!exportRows.length}>
            <Download size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label={hasActive ? "Filter history, filters active" : "Filter history"} onClick={() => setFilterOpen(true)}>
            <Filters size={20} aria-hidden="true" />
          </IconButton>
          <IconButton label="Refresh history" onClick={() => void refetch()}>
            <Refresh size={20} aria-hidden="true" />
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
            title="Filters"
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

                const scAddress = contractName ? tx.destination : fromContract ? tx.source : null;
                const contractIndex = scAddress
                  ? Object.entries(CONTRACT_NAMES).find(([, name]) => (contractName ?? fromContract) === name)?.[0]
                  : null;
                const procedureName = contractIndex !== undefined && contractIndex !== null && tx.inputType !== null
                  ? CONTRACT_PROCEDURE_NAMES[`${contractIndex}:${tx.inputType}`]
                  : undefined;

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

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT_SM: React.CSSProperties = { fontSize: "var(--text-mono-sm)", padding: "var(--space-2) var(--space-3)" };

const FILTER_SIDEBAR: React.CSSProperties = {
  width: 212,
  flexShrink: 0,
  borderRight: "1px solid var(--color-border-subtle)",
  overflowY: "auto",
  padding: "var(--space-4) var(--space-3)",
};

const FILTER_SHEET_BODY: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--space-1)" };

const FILTER_FOOTER: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };

const GHOST_BTN: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
  color: "var(--color-text-disabled)", padding: 0,
};

const APPLY_BTN: React.CSSProperties = {
  background: "var(--color-text-primary)", border: "none",
  borderRadius: "var(--radius-sharp)", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
  color: "var(--color-bg-base)",
  padding: "var(--space-2) var(--space-4)",
};

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{ padding: "var(--space-3) 0", borderTop: "1px solid var(--color-border-subtle)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>{children}</div>
    </section>
  );
}

function FilterHeader({ title, active, onReset }: { title: string; active: boolean; onReset: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)", paddingBottom: "var(--space-3)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>{title}</div>
      {active && <button type="button" onClick={onReset} style={GHOST_BTN}>Reset</button>}
    </div>
  );
}

function HistoryFilterControls({
  filters, draft, groupByCounterparty, commitOnFieldBlur = false, setFilters, setDraft, setGroupByCounterparty,
}: {
  filters: TxFilters;
  draft: DraftInputs;
  groupByCounterparty: boolean;
  commitOnFieldBlur?: boolean;
  setFilters: Dispatch<SetStateAction<TxFilters>>;
  setDraft: Dispatch<SetStateAction<DraftInputs>>;
  setGroupByCounterparty: Dispatch<SetStateAction<boolean>>;
}) {
  const fieldBlur = (key: keyof DraftInputs) => commitOnFieldBlur ? () => setFilters((f) => ({ ...f, [key]: key.includes("Amount") || key.includes("tick") ? sanitize(draft[key]) : draft[key] })) : undefined;
  return (
    <>
      <FilterSection label="Direction">
        {(["all", "in", "out"] as const).map((v) => (
          <FilterChoice key={v} label={v === "all" ? "All" : v === "in" ? "Incoming" : "Outgoing"} active={filters.direction === v} onClick={() => setFilters((f) => ({ ...f, direction: v }))} />
        ))}
      </FilterSection>
      <FilterSection label="Type">
        {(["all", "transfer", "sc"] as const).map((v) => (
          <FilterChoice key={v} label={v === "all" ? "All" : v === "sc" ? "SC calls" : "Transfers"} active={filters.type === v} onClick={() => setFilters((f) => ({ ...f, type: v }))} />
        ))}
      </FilterSection>
      <FilterSection label="Date range">
        <RangeInputs fromValue={draft.dateFrom} fromPlaceholder="From" toValue={draft.dateTo} toPlaceholder="To" type="date" onFromBlur={fieldBlur("dateFrom")} onToBlur={fieldBlur("dateTo")} onFromChange={(v) => setDraft((d) => ({ ...d, dateFrom: v }))} onToChange={(v) => setDraft((d) => ({ ...d, dateTo: v }))} />
      </FilterSection>
      <FilterSection label="Amount (QU)">
        <RangeInputs fromValue={draft.minAmount} fromPlaceholder="Min" toValue={draft.maxAmount} toPlaceholder="Max" onFromBlur={fieldBlur("minAmount")} onToBlur={fieldBlur("maxAmount")} onFromChange={(v) => setDraft((d) => ({ ...d, minAmount: v.replace(/\D/g, "") }))} onToChange={(v) => setDraft((d) => ({ ...d, maxAmount: v.replace(/\D/g, "") }))} />
      </FilterSection>
      <FilterSection label="Tick range">
        <RangeInputs fromValue={draft.tickFrom} fromPlaceholder="From" toValue={draft.tickTo} toPlaceholder="To" onFromBlur={fieldBlur("tickFrom")} onToBlur={fieldBlur("tickTo")} onFromChange={(v) => setDraft((d) => ({ ...d, tickFrom: v.replace(/\D/g, "") }))} onToChange={(v) => setDraft((d) => ({ ...d, tickTo: v.replace(/\D/g, "") }))} />
      </FilterSection>
      <FilterSection label="Group by">
        <FilterChoice label="None" active={!groupByCounterparty} onClick={() => setGroupByCounterparty(false)} />
        <FilterChoice label="Counterparty" active={groupByCounterparty} onClick={() => setGroupByCounterparty(true)} />
      </FilterSection>
    </>
  );
}

function RangeInputs({ fromValue, toValue, fromPlaceholder, toPlaceholder, type, onFromChange, onToChange, onFromBlur, onToBlur }: {
  fromValue: string; toValue: string; fromPlaceholder: string; toPlaceholder: string;
  type?: "date"; onFromChange: (v: string) => void; onToChange: (v: string) => void; onFromBlur?: () => void; onToBlur?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%" }}>
      <Input type={type} value={fromValue} onChange={(e) => onFromChange(e.target.value)} onBlur={onFromBlur} placeholder={fromPlaceholder} inputMode={type === "date" ? undefined : "numeric"} style={INPUT_SM} containerStyle={{ flex: 1, minWidth: 0 }} />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", flexShrink: 0 }}>–</span>
      <Input type={type} value={toValue} onChange={(e) => onToChange(e.target.value)} onBlur={onToBlur} placeholder={toPlaceholder} inputMode={type === "date" ? undefined : "numeric"} style={INPUT_SM} containerStyle={{ flex: 1, minWidth: 0 }} />
    </div>
  );
}

function FilterChoice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none",
      border: "none",
      borderBottom: `1px solid ${active ? "var(--color-text-primary)" : "var(--color-border-subtle)"}`,
      cursor: "pointer",
      fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
      color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      padding: "var(--space-2) var(--space-2) var(--space-1)",
    }}>
      {label}
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} style={{
      background: "none", border: "none", borderBottom: "1px solid var(--color-text-primary)", cursor: "pointer",
      fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
      color: "var(--color-text-primary)",
      padding: "var(--space-1) 0",
      display: "flex", alignItems: "center", gap: "var(--space-1)",
    }}>
      {label} <span style={{ fontSize: "var(--text-caption)", lineHeight: 1 }}>✕</span>
    </button>
  );
}

function ExportAction({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: "none", border: "none", borderBottom: "1px solid var(--color-border-subtle)", cursor: "pointer",
      fontFamily: "var(--font-sans)", color: "var(--color-text-primary)",
      padding: "var(--space-4) 0", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left",
    }}>
      <span style={{ fontSize: "var(--text-body)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{detail}</span>
    </button>
  );
}

function StatusText({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color }}>
      {children}
    </div>
  );
}

// ── Grouped-by-counterparty view ──────────────────────────────────────────────

function GroupedTxs({
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
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>{group.label}</span>
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
