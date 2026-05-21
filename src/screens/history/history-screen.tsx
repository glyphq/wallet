import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { Divider } from "@/components/divider";
import { Modal } from "@/components/modal";
import { Sheet } from "@/components/sheet";
import { IdentityDisplay } from "@/components/identity-display";
import { usePersistedStore, type PendingTx } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTxHistory, type TxHistoryItem } from "@/hooks/use-tx-history";
import { useTickInfo } from "@/hooks/use-tick-info";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { truncateId, formatQu } from "@/lib/format";

type FilterDirection = "all" | "in" | "out";
type FilterStatus = "all" | "confirmed" | "failed" | "sc";

type TxFilters = {
  direction: FilterDirection;
  status: FilterStatus;
};

const DEFAULT_FILTERS: TxFilters = { direction: "all", status: "all" };

function isDefaultFilters(f: TxFilters) {
  return f.direction === "all" && f.status === "all";
}

export default function HistoryScreen() {
  const navigate = useNavigate();

  const settings = usePersistedStore((s) => s.settings);
  const hideBalances = settings.hideBalances;
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const wallets = useSessionStore((s) => s.wallets);
  const identity = wallets[settings.activeAccountIndex]?.identity ?? null;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useTxHistory(identity);
  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  const [filters, setFilters] = useState<TxFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<TxHistoryItem | PendingTx | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setFilters(DEFAULT_FILTERS); }, [identity]);

  // Infinite scroll: fetch next page when sentinel enters view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isExpired = (p: PendingTx) => currentTick > 0 && currentTick > p.targetTick;

  const myPending = pendingTxs.filter(
    (p) => p.source === identity || p.destination === identity,
  );
  const fetchedHashes = new Set((data?.pages.flat() ?? []).map((t) => t.hash));
  const visiblePending = myPending.filter((p) => !fetchedHashes.has(p.hash));

  const allTxs = data?.pages.flat() ?? [];

  const filteredPending = visiblePending.filter((p) => {
    if (filters.direction === "in") return p.destination === identity;
    if (filters.direction === "out") return p.source === identity;
    return true;
  });

  const filteredTxs = allTxs.filter((tx) => {
    const isIn = tx.destination === identity;
    const isSc = !!(
      (tx.destination && KNOWN_CONTRACT_ADDRESSES[tx.destination]) ||
      (tx.source && KNOWN_CONTRACT_ADDRESSES[tx.source])
    );
    if (filters.direction === "in" && !isIn) return false;
    if (filters.direction === "out" && tx.source !== identity) return false;
    if (filters.status === "confirmed" && !tx.moneyFlew) return false;
    if (filters.status === "failed" && tx.moneyFlew) return false;
    if (filters.status === "sc" && !isSc) return false;
    return true;
  });

  const hasActive = !isDefaultFilters(filters);

  const headerActions = (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
          color: hasActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
          letterSpacing: "0.05em", padding: 0, display: "flex", alignItems: "center", gap: 4,
        }}
      >
        FILTER{hasActive && <span style={{ color: "var(--color-status-success)", fontSize: 8, lineHeight: 1 }}>●</span>}
      </button>
      <button
        type="button"
        onClick={() => refetch()}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0 }}
      >
        ↻
      </button>
    </div>
  );

  const statusBar = (
    <ScreenHeader title="Transactions" onBack={() => navigate("/dashboard")} action={headerActions} />
  );

  const isEmpty = filteredPending.length === 0 && filteredTxs.length === 0;

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column" }}>

      {/* Active filter summary strip */}
      {hasActive && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          {filters.direction !== "all" && (
            <ActiveFilterChip label={filters.direction.toUpperCase()} onRemove={() => setFilters((f) => ({ ...f, direction: "all" }))} />
          )}
          {filters.status !== "all" && (
            <ActiveFilterChip label={filters.status === "sc" ? "SC CALL" : filters.status.toUpperCase()} onRemove={() => setFilters((f) => ({ ...f, status: "all" }))} />
          )}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [LOADING...]
        </div>
      )}

      {isError && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
          [NETWORK ERROR]
        </div>
      )}

      {!isLoading && !isError && isEmpty && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          {allTxs.length === 0 && visiblePending.length === 0 ? "[NO TRANSACTIONS YET]" : "[NO RESULTS]"}
        </div>
      )}

      {/* Transaction rows */}
      {!isLoading && !isError && !isEmpty && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filteredPending.map((p, i) => {
            const isIncoming = p.destination === identity;
            const expired = isExpired(p);
            return (
              <div key={`pending-${p.hash}`}>
                {i > 0 && <Divider style={{ margin: "var(--space-3) 0" }} />}
                <button
                  type="button"
                  onClick={() => setDetail(p)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left" }}
                >
                  <TxRow
                    tag={<Tag variant={expired ? "error" : "warning"}>{expired ? "FAILED" : "PENDING"}</Tag>}
                    sub={p.contractName ?? (isIncoming ? truncateId(p.source) : truncateId(p.destination))}
                    sub2={expired ? `EXPIRED AT TICK ${p.targetTick}` : currentTick > 0 ? `ETA ~${Math.max(1, p.targetTick - currentTick)}s` : `TARGET ${p.targetTick}`}
                    amount={hideBalances ? "••••••" : `−${formatQu(p.amount)}`}
                    amountColor={expired ? "var(--color-text-disabled)" : "var(--color-status-warning)"}
                  />
                </button>
              </div>
            );
          })}

          {filteredTxs.map((tx, i) => {
            const isIncoming = tx.destination === identity;
            const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
            const fromContractName = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
            const isSc = !!(contractName || fromContractName);
            const flew = tx.moneyFlew;
            const statusVariant = !flew ? "error" : isSc ? "neutral" : isIncoming ? "success" : "neutral";
            const statusLabel = !flew ? "FAILED" : isSc ? "SC CALL" : isIncoming ? "RECEIVED" : "SENT";
            const counterparty = isSc
              ? (contractName ?? fromContractName ?? truncateId(isIncoming ? (tx.source ?? "—") : (tx.destination ?? "—")))
              : truncateId(isIncoming ? (tx.source ?? "—") : (tx.destination ?? "—"));
            const offset = filteredPending.length + i;
            return (
              <div key={tx.hash}>
                {offset > 0 && <Divider style={{ margin: "var(--space-3) 0" }} />}
                <button
                  type="button"
                  onClick={() => setDetail(tx)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left" }}
                >
                  <TxRow
                    tag={<Tag variant={statusVariant}>{statusLabel}</Tag>}
                    sub={counterparty}
                    sub2={`TICK ${tx.tickNumber}`}
                    amount={hideBalances ? "••••••" : `${isIncoming ? "+" : "−"}${formatQu(tx.amount ?? "0")}`}
                    amountColor={flew ? (isIncoming ? "var(--color-status-success)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {isFetchingNextPage && (
        <div style={{ textAlign: "center", padding: "var(--space-4) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [LOADING...]
        </div>
      )}

      {!hasNextPage && allTxs.length > 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-4) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          ── END ──
        </div>
      )}

      {/* Filter sheet */}
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
        <FilterSection label="Direction">
          {(["all", "in", "out"] as FilterDirection[]).map((v) => (
            <FilterPill key={v} label={v === "all" ? "ALL" : v === "in" ? "IN" : "OUT"} active={filters.direction === v} onClick={() => setFilters((f) => ({ ...f, direction: v }))} />
          ))}
        </FilterSection>
        <FilterSection label="Status">
          {(["all", "confirmed", "failed", "sc"] as FilterStatus[]).map((v) => (
            <FilterPill key={v} label={v === "all" ? "ALL" : v === "sc" ? "SC CALL" : v.toUpperCase()} active={filters.status === v} onClick={() => setFilters((f) => ({ ...f, status: v }))} />
          ))}
        </FilterSection>
        {hasActive && (
          <button
            type="button"
            onClick={() => { setFilters(DEFAULT_FILTERS); setFilterOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", padding: 0, marginTop: "var(--space-2)" }}
          >
            RESET FILTERS
          </button>
        )}
      </Sheet>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)}>
        {detail && <TxDetail detail={detail} identity={identity} />}
      </Modal>
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TxRow({ tag, sub, sub2, amount, amountColor }: {
  tag: ReactNode; sub: string; sub2: string; amount: string; amountColor: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ marginBottom: "var(--space-1)" }}>{tag}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>{sub}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", marginTop: 2 }}>{sub2}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: amountColor }}>{amount}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>QU</div>
      </div>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-5)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "var(--space-3)" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {children}
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "var(--color-text-primary)" : "none",
        border: `1px solid ${active ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        color: active ? "var(--color-bg-base)" : "var(--color-text-secondary)",
        letterSpacing: "0.05em",
        padding: "var(--space-1) var(--space-3)",
        textTransform: "uppercase",
      }}
    >
      {label}
    </button>
  );
}

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      style={{
        background: "none",
        border: "1px solid var(--color-text-primary)",
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        color: "var(--color-text-primary)",
        letterSpacing: "0.05em",
        padding: "var(--space-1) var(--space-2)",
        display: "flex", alignItems: "center", gap: "var(--space-1)",
      }}
    >
      {label} ✕
    </button>
  );
}

function TxDetail({ detail, identity }: { detail: TxHistoryItem | PendingTx; identity: string | null }) {
  const hideBalances = usePersistedStore((s) => s.settings.hideBalances);
  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  const isPending = (d: TxHistoryItem | PendingTx): d is PendingTx => "broadcastAt" in d;

  const contractName = detail.destination ? KNOWN_CONTRACT_ADDRESSES[detail.destination] : undefined;
  const fromContractName = detail.source ? KNOWN_CONTRACT_ADDRESSES[detail.source] : undefined;
  const isSc = !!(contractName || fromContractName);

  if (isPending(detail)) {
    const expired = currentTick > 0 && currentTick > detail.targetTick;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Tag variant={expired ? "error" : "warning"}>{expired ? "FAILED" : "PENDING"}</Tag>
          {detail.contractName && <Tag variant="neutral">{detail.contractName}</Tag>}
        </div>
        <DetailRow label="Amount">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-display)" }}>
            {hideBalances ? "••••••" : `${formatQu(detail.amount ?? "0")} QU`}
          </span>
        </DetailRow>
        <DetailRow label="From">
          {detail.source ? <IdentityDisplay identity={detail.source} /> : <Dash />}
        </DetailRow>
        <DetailRow label="To">
          {detail.destination ? <IdentityDisplay identity={detail.destination} /> : <Dash />}
        </DetailRow>
        <DetailRow label="Target tick">
          <Mono>{detail.targetTick}</Mono>
        </DetailRow>
        {detail.hash && (
          <DetailRow label="Hash"><IdentityDisplay identity={detail.hash} /></DetailRow>
        )}
      </div>
    );
  }

  const isIncoming = detail.destination === identity;
  const flew = detail.moneyFlew;
  const statusVariant = !flew ? "error" : isSc ? "neutral" : isIncoming ? "success" : "neutral";
  const statusLabel = !flew ? "FAILED" : isSc ? "SC CALL" : isIncoming ? "RECEIVED" : "SENT";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <Tag variant={statusVariant}>{statusLabel}</Tag>
        {isSc && <Tag variant="neutral">{contractName ?? fromContractName ?? ""}</Tag>}
      </div>
      <DetailRow label="Amount">
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-display)" }}>
          {hideBalances ? "••••••" : `${formatQu(detail.amount ?? "0")} QU`}
        </span>
      </DetailRow>
      <DetailRow label="From">
        {detail.source ? <IdentityDisplay identity={detail.source} /> : <Dash />}
      </DetailRow>
      <DetailRow label="To">
        {detail.destination ? <IdentityDisplay identity={detail.destination} /> : <Dash />}
      </DetailRow>
      <DetailRow label="Tick">
        <Mono>{detail.tickNumber ?? "—"}</Mono>
      </DetailRow>
      {detail.hash && (
        <DetailRow label="Hash"><IdentityDisplay identity={detail.hash} /></DetailRow>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)" }}>
      {children}
    </span>
  );
}

function Dash() {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)" }}>—</span>;
}
