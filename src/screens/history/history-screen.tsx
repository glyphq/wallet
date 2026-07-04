import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { presets } from "@/lib/animations";
import { AltArrowLeft, Download, Filters, Refresh, Chart, ArrowRightUp, ArrowToDownLeft, Bolt, ShieldWarning, ClockCircle } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
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
import { truncateId, formatQuCompact, formatDate, formatUsdFromQu } from "@/lib/format";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { findClosestPriceSnapshot } from "@/lib/history-analytics";

// ── Filter types ──────────────────────────────────────────────────────────────

type TxFilters = TxQueryFilters;

const DEFAULT_FILTERS: TxFilters = { ...DEFAULT_QUERY_FILTERS };

// Draft state for text inputs — committed on APPLY
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
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)",
        width: "100%", background: "none", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left",
      }}
    >
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
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          {TypeIcon && <TypeIcon size={14} style={{ color: amountColor, opacity: 0.7 }} />}
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: amountColor, fontVariantNumeric: "tabular-nums" }}>
            {amount}
          </span>
        </div>
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
  const priceSnapshots = usePersistedStore((s) => s.priceSnapshots);

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
  const [memoExportOpen, setMemoExportOpen] = useState(false);
  const [memoDateFrom, setMemoDateFrom] = useState("");
  const [memoDateTo, setMemoDateTo] = useState("");
  const [memoMinAmount, setMemoMinAmount] = useState("");

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
    const blob = new Blob([JSON.stringify(Object.fromEntries(entries), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glyph-memos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMemoExportOpen(false);
  }

  const hasMemos = Object.values(txMemos).some((v) => v.trim());
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTxHistory(identity, filters);
  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  // Intentionally not resetting filters on identity change — user keeps their filter context when switching accounts.

  // Sync draft when sheet opens so edits start from current values
  useEffect(() => { if (filterOpen) setDraft(toDraft(filters)); }, [filterOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const allTxs = data?.pages.flat() ?? [];
  const fetchedHashes = new Set(allTxs.map((t) => t.hash));
  const myPending = pendingTxs.filter((p) => p.source === identity || p.destination === identity);
  const visiblePending = myPending.filter((p) => !fetchedHashes.has(p.hash));

  const filteredPending = visiblePending.filter((p) => {
    if (filters.direction === "in") return p.destination === identity;
    if (filters.direction === "out") return p.source === identity;
    return true;
  });

  const filteredTxs = allTxs;
  const pendingHashes = new Set(pendingTxs.map((p) => p.hash));
  const hasActive = !isDefault(filters);
  const isExpired = (p: PendingTx) => currentTick > 0 && currentTick > p.targetTick;

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

  // ── Header ────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 var(--space-4)" }}>
      <button type="button" onClick={() => navigate("/dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2) 0", display: "flex", alignItems: "center" }}>
        <AltArrowLeft size={20} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", whiteSpace: "nowrap" }}>
        Transactions
      </span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        {hasMemos && (
          <button type="button" onClick={() => setMemoExportOpen(true)} aria-label="Export memos" style={ICON_BTN}>
            <Download size={15} weight="Linear" />
          </button>
        )}
        <button type="button" onClick={() => navigate("/analytics")} aria-label="Analytics" style={ICON_BTN}>
          <Chart size={15} weight="Linear" />
        </button>
        {!wideLayout && (
          <button type="button" onClick={() => setFilterOpen(true)} aria-label="Filter" style={{ ...ICON_BTN, color: hasActive ? "var(--color-text-primary)" : "var(--color-text-secondary)", position: "relative" }}>
            <Filters size={15} weight="Linear" />
            {hasActive && <span style={{ position: "absolute", top: -2, right: -3, width: 5, height: 5, borderRadius: "50%", background: "var(--color-status-success)" }} />}
          </button>
        )}
        <button type="button" onClick={() => refetch()} aria-label="Refresh" style={ICON_BTN}>
          <Refresh size={15} weight="Linear" />
        </button>
      </div>
    </div>
  );

  return (
    <AppShell
      statusBar={header}
      fullBleed
      contentStyle={{ display: "flex", flexDirection: "row", overflow: "hidden", flex: 1, padding: 0 }}
    >
      {/* ── Wide-screen sticky filter sidebar ── */}
      {wideLayout && (
        <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--color-border-subtle)", overflowY: "auto", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>
            Filter
            {hasActive && (
              <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setDraft(toDraft(DEFAULT_FILTERS)); }} style={{ marginLeft: "var(--space-3)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-warning)", padding: 0 }}>
                Reset
              </button>
            )}
          </div>
          <FilterSection label="Direction">
            {(["all", "in", "out"] as const).map((v) => (
              <Pill key={v} label={v === "all" ? "All" : v === "in" ? "In" : "Out"} active={filters.direction === v} onClick={() => setFilters((f) => ({ ...f, direction: v }))} />
            ))}
          </FilterSection>
          <FilterSection label="Type">
            {(["all", "transfer", "sc"] as const).map((v) => (
              <Pill key={v} label={v === "all" ? "All" : v === "sc" ? "SC calls" : "Transfers"} active={filters.type === v} onClick={() => setFilters((f) => ({ ...f, type: v }))} />
            ))}
          </FilterSection>
          <FilterSection label="Group by">
            <Pill label="None" active={!groupByCounterparty} onClick={() => setGroupByCounterparty(false)} />
            <Pill label="Counterparty" active={groupByCounterparty} onClick={() => setGroupByCounterparty(true)} />
          </FilterSection>
          <FilterSection label="Date from">
            <Input type="date" value={draft.dateFrom} onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))} onBlur={() => setFilters((f) => ({ ...f, dateFrom: draft.dateFrom }))} style={INPUT_SM} containerStyle={{ width: "100%" }} />
          </FilterSection>
          <FilterSection label="Date to">
            <Input type="date" value={draft.dateTo} onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))} onBlur={() => setFilters((f) => ({ ...f, dateTo: draft.dateTo }))} style={INPUT_SM} containerStyle={{ width: "100%" }} />
          </FilterSection>
          <FilterSection label="Min QU">
            <Input value={draft.minAmount} onChange={(e) => setDraft((d) => ({ ...d, minAmount: e.target.value.replace(/\D/g, "") }))} onBlur={() => setFilters((f) => ({ ...f, minAmount: sanitize(draft.minAmount) }))} placeholder="0" inputMode="numeric" style={INPUT_SM} containerStyle={{ width: "100%" }} />
          </FilterSection>
          <FilterSection label="Max QU">
            <Input value={draft.maxAmount} onChange={(e) => setDraft((d) => ({ ...d, maxAmount: e.target.value.replace(/\D/g, "") }))} onBlur={() => setFilters((f) => ({ ...f, maxAmount: sanitize(draft.maxAmount) }))} placeholder="∞" inputMode="numeric" style={INPUT_SM} containerStyle={{ width: "100%" }} />
          </FilterSection>
        </div>
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
            <Button variant="secondary" shape="sharp" size="sm" onClick={() => navigate("/send")}>Send your first transaction</Button>
          </div>
        ) : (
          <StatusText color="var(--color-text-disabled)">No results</StatusText>
        )
      )}

      {/* Transaction rows */}
      {!isLoading && !isError && groupByCounterparty && filteredTxs.length > 0 && (
        <GroupedTxs txs={filteredTxs} identity={identity} settings={settings} priceSnapshots={priceSnapshots} onSelect={(tx) => navigate(`/tx/${tx.hash}`)} />
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
                amountUsd={settings.hideBalances || !pendingSnapshot ? undefined : `≈ $${formatUsdFromQu(p.amount, pendingSnapshot.priceUsd)}`}
                amountColor={expired ? "var(--color-text-disabled)" : "var(--color-status-warning)"}
                txType={expired ? "failed" : "pending"}
              />
            );
          })}

          {groupTxsByDate(filteredTxs).map((section) => (
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
                  ? (contractName ?? fromContract ?? truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—")))
                  : truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—"));
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
                    amountUsd={settings.hideBalances || !snapshot ? undefined : `≈ $${formatUsdFromQu(tx.amount, snapshot.priceUsd)}`}
                    amountColor={flew ? (isIn ? "var(--color-accent)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
                    txType={txType}
                  />
                );
              })}
            </div>
          ))}
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
      {!hasNextPage && allTxs.length > 0 && <StatusText color="var(--color-text-disabled)">End</StatusText>}

      </motion.div>
      </div>{/* end main content column */}

      {/* ── Filter sheet ────────────────────────────────────────────────────── */}
      <Sheet
        open={filterOpen}
        onClose={applyAndClose}
        title="Filter"
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {hasActive ? (
              <button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setDraft(toDraft(DEFAULT_FILTERS)); setFilterOpen(false); }} style={GHOST_BTN}>
                Reset all
              </button>
            ) : <span />}
            <button type="button" onClick={applyAndClose} style={APPLY_BTN}>Apply</button>
          </div>
        }
      >

        <FilterSection label="Direction">
          {(["all", "in", "out"] as const).map((v) => (
            <Pill key={v} label={v === "all" ? "All" : v === "in" ? "In" : "Out"} active={filters.direction === v} onClick={() => setFilters((f) => ({ ...f, direction: v }))} />
          ))}
        </FilterSection>

        <FilterSection label="Type">
          {(["all", "transfer", "sc"] as const).map((v) => (
            <Pill key={v} label={v === "all" ? "All" : v === "sc" ? "SC calls" : "Transfers"} active={filters.type === v} onClick={() => setFilters((f) => ({ ...f, type: v }))} />
          ))}
        </FilterSection>

        <FilterSection label="Date range">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%" }}>
            <Input type="date" value={draft.dateFrom} onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))} style={INPUT_SM} containerStyle={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", flexShrink: 0 }}>–</span>
            <Input type="date" value={draft.dateTo} onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))} style={INPUT_SM} containerStyle={{ flex: 1 }} />
          </div>
        </FilterSection>

        <FilterSection label="Amount (QU)">
          <RangeInputs
            fromValue={draft.minAmount} fromPlaceholder="Min"
            toValue={draft.maxAmount} toPlaceholder="Max"
            onFromChange={(v) => setDraft((d) => ({ ...d, minAmount: v }))}
            onToChange={(v) => setDraft((d) => ({ ...d, maxAmount: v }))}
          />
        </FilterSection>

        <FilterSection label="Tick range">
          <RangeInputs
            fromValue={draft.tickFrom} fromPlaceholder="From"
            toValue={draft.tickTo} toPlaceholder="To"
            onFromChange={(v) => setDraft((d) => ({ ...d, tickFrom: v }))}
            onToChange={(v) => setDraft((d) => ({ ...d, tickTo: v }))}
          />
        </FilterSection>

        <FilterSection label="Group by">
          <Pill label="None" active={!groupByCounterparty} onClick={() => setGroupByCounterparty(false)} />
          <Pill label="Counterparty" active={groupByCounterparty} onClick={() => setGroupByCounterparty(true)} />
        </FilterSection>

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

const ICON_BTN: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0,
  display: "flex", alignItems: "center", color: "var(--color-text-secondary)",
};

const INPUT_SM: React.CSSProperties = { fontSize: "var(--text-mono-sm)", padding: "var(--space-2) var(--space-3)" };

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
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>{children}</div>
    </div>
  );
}

function RangeInputs({ fromValue, toValue, fromPlaceholder, toPlaceholder, onFromChange, onToChange }: {
  fromValue: string; toValue: string; fromPlaceholder: string; toPlaceholder: string;
  onFromChange: (v: string) => void; onToChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", width: "100%" }}>
      <Input value={fromValue} onChange={(e) => onFromChange(e.target.value)} placeholder={fromPlaceholder} inputMode="numeric" style={INPUT_SM} containerStyle={{ flex: 1 }} />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", flexShrink: 0 }}>–</span>
      <Input value={toValue} onChange={(e) => onToChange(e.target.value)} placeholder={toPlaceholder} inputMode="numeric" style={INPUT_SM} containerStyle={{ flex: 1 }} />
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      background: active ? "var(--color-text-primary)" : "none",
      border: `1px solid ${active ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
      borderRadius: "var(--radius-sharp)", cursor: "pointer",
      fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
      color: active ? "var(--color-bg-base)" : "var(--color-text-secondary)",
      padding: "var(--space-1) var(--space-3)",
    }}>
      {label}
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" onClick={onRemove} style={{
      background: "none", border: "1px solid var(--color-text-primary)",
      borderRadius: "var(--radius-sharp)", cursor: "pointer",
      fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)",
      color: "var(--color-text-primary)",
      padding: "var(--space-1) var(--space-2)",
      display: "flex", alignItems: "center", gap: "var(--space-1)",
    }}>
      {label} <span style={{ fontSize: "var(--text-caption)", lineHeight: 1 }}>✕</span>
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
  txs, identity, settings, priceSnapshots, onSelect,
}: {
  txs: TxHistoryItem[];
  identity: string | null;
  settings: AppSettings;
  priceSnapshots: PriceSnapshot[];
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
                amountUsd={settings.hideBalances || !snapshot ? undefined : `≈ $${formatUsdFromQu(tx.amount, snapshot.priceUsd)}`}
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
