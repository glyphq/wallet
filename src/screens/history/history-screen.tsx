import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { Divider } from "@/components/divider";
import { Modal } from "@/components/modal";
import { Sheet } from "@/components/sheet";
import { Input } from "@/components/input";
import { IdentityDisplay } from "@/components/identity-display";
import { usePersistedStore, type PendingTx } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useTxHistory, type TxHistoryItem, type TxQueryFilters, DEFAULT_QUERY_FILTERS } from "@/hooks/use-tx-history";
import { useTickInfo } from "@/hooks/use-tick-info";
import { KNOWN_CONTRACT_ADDRESSES } from "@/lib/contracts";
import { truncateId, formatQu } from "@/lib/format";

type FilterStatus = "all" | "confirmed" | "failed";

type TxFilters = TxQueryFilters & { status: FilterStatus };

const DEFAULT_FILTERS: TxFilters = { ...DEFAULT_QUERY_FILTERS, status: "all" };

function isDefault(f: TxFilters) {
  return f.direction === "all" && f.type === "all" && f.status === "all" && f.minAmount === "" && f.period === "all";
}

export default function HistoryScreen() {
  const navigate = useNavigate();
  const settings = usePersistedStore((s) => s.settings);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const wallets = useSessionStore((s) => s.wallets);
  const identity = wallets[settings.activeAccountIndex]?.identity ?? null;

  const [filters, setFilters] = useState<TxFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [minAmountInput, setMinAmountInput] = useState("");
  const [detail, setDetail] = useState<TxHistoryItem | PendingTx | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTxHistory(identity, filters);

  const { data: tickInfo } = useTickInfo();
  const currentTick = tickInfo?.tick ?? 0;

  useEffect(() => { setFilters(DEFAULT_FILTERS); setMinAmountInput(""); }, [identity]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allTxs = data?.pages.flat() ?? [];
  const fetchedHashes = new Set(allTxs.map((t) => t.hash));
  const myPending = pendingTxs.filter((p) => p.source === identity || p.destination === identity);
  const visiblePending = myPending.filter((p) => !fetchedHashes.has(p.hash));

  const filteredPending = visiblePending.filter((p) => {
    if (filters.direction === "in") return p.destination === identity;
    if (filters.direction === "out") return p.source === identity;
    return true;
  });

  const filteredTxs = allTxs.filter((tx) => {
    if (filters.status === "confirmed" && !tx.moneyFlew) return false;
    if (filters.status === "failed" && tx.moneyFlew) return false;
    return true;
  });

  const hasActive = !isDefault(filters);
  const isExpired = (p: PendingTx) => currentTick > 0 && currentTick > p.targetTick;

  function applyMinAmount() {
    const n = minAmountInput.trim();
    if (!n || isNaN(Number(n)) || Number(n) < 0) return;
    setFilters((f) => ({ ...f, minAmount: n === "0" ? "" : n }));
  }

  const headerActions = (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", padding: 0, display: "flex", alignItems: "center", gap: 4, color: hasActive ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
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

  return (
    <AppShell
      statusBar={<ScreenHeader title="Transactions" onBack={() => navigate("/dashboard")} action={headerActions} />}
      contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column" }}
    >
      {/* Active filter chips */}
      {hasActive && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          {filters.direction !== "all" && (
            <ActiveChip label={filters.direction.toUpperCase()} onRemove={() => setFilters((f) => ({ ...f, direction: "all" }))} />
          )}
          {filters.type !== "all" && (
            <ActiveChip label={filters.type === "sc" ? "SC CALL" : "TRANSFER"} onRemove={() => setFilters((f) => ({ ...f, type: "all" }))} />
          )}
          {filters.status !== "all" && (
            <ActiveChip label={filters.status.toUpperCase()} onRemove={() => setFilters((f) => ({ ...f, status: "all" }))} />
          )}
          {filters.period !== "all" && (
            <ActiveChip label={filters.period.toUpperCase()} onRemove={() => setFilters((f) => ({ ...f, period: "all" }))} />
          )}
          {filters.minAmount !== "" && (
            <ActiveChip label={`≥ ${formatQu(filters.minAmount)} QU`} onRemove={() => { setFilters((f) => ({ ...f, minAmount: "" })); setMinAmountInput(""); }} />
          )}
        </div>
      )}

      {isLoading && <Mono style={{ textAlign: "center", padding: "var(--space-12) 0", color: "var(--color-text-disabled)" }}>[LOADING...]</Mono>}
      {isError && <Mono style={{ textAlign: "center", padding: "var(--space-12) 0", color: "var(--color-status-error)" }}>[NETWORK ERROR]</Mono>}

      {!isLoading && !isError && filteredPending.length === 0 && filteredTxs.length === 0 && (
        <Mono style={{ textAlign: "center", padding: "var(--space-12) 0", color: "var(--color-text-disabled)" }}>
          {allTxs.length === 0 && visiblePending.length === 0 ? "[NO TRANSACTIONS YET]" : "[NO RESULTS]"}
        </Mono>
      )}

      {!isLoading && !isError && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filteredPending.map((p, i) => {
            const isIn = p.destination === identity;
            const expired = isExpired(p);
            return (
              <div key={`p-${p.hash}`}>
                {i > 0 && <Divider style={{ margin: "var(--space-3) 0" }} />}
                <button type="button" onClick={() => setDetail(p)} style={ROW_BTN}>
                  <TxRow
                    tag={<Tag variant={expired ? "error" : "warning"}>{expired ? "FAILED" : "PENDING"}</Tag>}
                    sub={p.contractName ?? (isIn ? truncateId(p.source) : truncateId(p.destination))}
                    sub2={expired ? `EXPIRED AT TICK ${p.targetTick}` : currentTick > 0 ? `ETA ~${Math.max(1, p.targetTick - currentTick)}s` : `TARGET ${p.targetTick}`}
                    amount={settings.hideBalances ? "••••••" : `−${formatQu(p.amount)}`}
                    amountColor={expired ? "var(--color-text-disabled)" : "var(--color-status-warning)"}
                  />
                </button>
              </div>
            );
          })}

          {filteredTxs.map((tx, i) => {
            const isIn = tx.destination === identity;
            const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
            const fromContract = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
            const isSc = !!(contractName || fromContract);
            const flew = tx.moneyFlew;
            const variant = !flew ? "error" : isSc ? "neutral" : isIn ? "success" : "neutral";
            const label = !flew ? "FAILED" : isSc ? "SC CALL" : isIn ? "RECEIVED" : "SENT";
            const counterparty = isSc
              ? (contractName ?? fromContract ?? truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—")))
              : truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—"));
            const offset = filteredPending.length + i;
            return (
              <div key={tx.hash}>
                {offset > 0 && <Divider style={{ margin: "var(--space-3) 0" }} />}
                <button type="button" onClick={() => setDetail(tx)} style={ROW_BTN}>
                  <TxRow
                    tag={<Tag variant={variant}>{label}</Tag>}
                    sub={counterparty}
                    sub2={`TICK ${tx.tickNumber}`}
                    amount={settings.hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQu(tx.amount)}`}
                    amountColor={flew ? (isIn ? "var(--color-status-success)" : "var(--color-text-primary)") : "var(--color-text-disabled)"}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel + loading indicator */}
      <div ref={sentinelRef} style={{ height: 1 }} />
      {isFetchingNextPage && (
        <Mono style={{ textAlign: "center", padding: "var(--space-4) 0", color: "var(--color-text-disabled)" }}>[LOADING...]</Mono>
      )}
      {!hasNextPage && allTxs.length > 0 && (
        <Mono style={{ textAlign: "center", padding: "var(--space-4) 0", color: "var(--color-text-disabled)" }}>── END ──</Mono>
      )}

      {/* Filter sheet */}
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter">
        <FilterSection label="Direction">
          {(["all", "in", "out"] as const).map((v) => (
            <Pill key={v} label={v === "all" ? "ALL" : v.toUpperCase()} active={filters.direction === v} onClick={() => setFilters((f) => ({ ...f, direction: v }))} />
          ))}
        </FilterSection>

        <FilterSection label="Type">
          {(["all", "transfer", "sc"] as const).map((v) => (
            <Pill key={v} label={v === "all" ? "ALL" : v === "sc" ? "SC CALL" : "TRANSFER"} active={filters.type === v} onClick={() => setFilters((f) => ({ ...f, type: v }))} />
          ))}
        </FilterSection>

        <FilterSection label="Status">
          {(["all", "confirmed", "failed"] as const).map((v) => (
            <Pill key={v} label={v.toUpperCase()} active={filters.status === v} onClick={() => setFilters((f) => ({ ...f, status: v }))} />
          ))}
        </FilterSection>

        <FilterSection label="Period">
          {(["all", "7d", "30d"] as const).map((v) => (
            <Pill key={v} label={v === "all" ? "ALL" : v.toUpperCase()} active={filters.period === v} onClick={() => setFilters((f) => ({ ...f, period: v }))} />
          ))}
        </FilterSection>

        <FilterSection label="Min amount (QU)">
          <div style={{ display: "flex", gap: "var(--space-2)", width: "100%" }}>
            <Input
              value={minAmountInput}
              onChange={(e) => setMinAmountInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { applyMinAmount(); setFilterOpen(false); } }}
              placeholder="0"
              inputMode="numeric"
              style={{ fontSize: "var(--text-mono-sm)", padding: "8px 12px" }}
            />
            <button
              type="button"
              onClick={() => { applyMinAmount(); setFilterOpen(false); }}
              style={{ background: "var(--color-text-primary)", border: "none", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-bg-base)", letterSpacing: "0.05em", padding: "0 var(--space-3)", whiteSpace: "nowrap" }}
            >
              APPLY
            </button>
          </div>
        </FilterSection>

        {hasActive && (
          <button
            type="button"
            onClick={() => { setFilters(DEFAULT_FILTERS); setMinAmountInput(""); setFilterOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", padding: 0, marginTop: "var(--space-2)" }}
          >
            RESET ALL
          </button>
        )}
      </Sheet>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)}>
        {detail && <TxDetail detail={detail} identity={identity} currentTick={currentTick} />}
      </Modal>
    </AppShell>
  );
}

// ── Shared style ──────────────────────────────────────────────────────────────

const ROW_BTN: React.CSSProperties = {
  width: "100%", background: "none", border: "none", cursor: "pointer",
  padding: "var(--space-3) 0", textAlign: "left",
};

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
      <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: "var(--space-3)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: amountColor }}>{amount}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>QU</div>
      </div>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "var(--space-6)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "var(--space-3)" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>{children}</div>
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? "var(--color-text-primary)" : "none",
        border: `1px solid ${active ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
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

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      style={{
        background: "none",
        border: "1px solid var(--color-text-primary)",
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
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

function Mono({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.05em", display: "block", ...style }}>
      {children}
    </span>
  );
}

function TxDetail({ detail, identity, currentTick }: { detail: TxHistoryItem | PendingTx; identity: string | null; currentTick: number }) {
  const hideBalances = usePersistedStore((s) => s.settings.hideBalances);
  const isPending = (d: TxHistoryItem | PendingTx): d is PendingTx => "broadcastAt" in d;

  const contractName = detail.destination ? KNOWN_CONTRACT_ADDRESSES[detail.destination] : undefined;
  const fromContract = detail.source ? KNOWN_CONTRACT_ADDRESSES[detail.source] : undefined;
  const isSc = !!(contractName || fromContract);

  if (isPending(detail)) {
    const expired = currentTick > 0 && currentTick > detail.targetTick;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Tag variant={expired ? "error" : "warning"}>{expired ? "FAILED" : "PENDING"}</Tag>
          {detail.contractName && <Tag variant="neutral">{detail.contractName}</Tag>}
        </div>
        <DetailRow label="Amount"><AmountDisplay amount={detail.amount ?? "0"} hide={hideBalances} /></DetailRow>
        <DetailRow label="From">{detail.source ? <IdentityDisplay identity={detail.source} /> : <Dash />}</DetailRow>
        <DetailRow label="To">{detail.destination ? <IdentityDisplay identity={detail.destination} /> : <Dash />}</DetailRow>
        <DetailRow label="Target tick"><MonoValue>{detail.targetTick}</MonoValue></DetailRow>
        {detail.hash && <DetailRow label="Hash"><IdentityDisplay identity={detail.hash} /></DetailRow>}
      </div>
    );
  }

  const isIn = detail.destination === identity;
  const flew = detail.moneyFlew;
  const variant = !flew ? "error" : isSc ? "neutral" : isIn ? "success" : "neutral";
  const label = !flew ? "FAILED" : isSc ? "SC CALL" : isIn ? "RECEIVED" : "SENT";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Tag variant={variant}>{label}</Tag>
        {isSc && <Tag variant="neutral">{contractName ?? fromContract ?? ""}</Tag>}
      </div>
      <DetailRow label="Amount"><AmountDisplay amount={detail.amount ?? "0"} hide={hideBalances} /></DetailRow>
      <DetailRow label="From">{detail.source ? <IdentityDisplay identity={detail.source} /> : <Dash />}</DetailRow>
      <DetailRow label="To">{detail.destination ? <IdentityDisplay identity={detail.destination} /> : <Dash />}</DetailRow>
      <DetailRow label="Tick"><MonoValue>{detail.tickNumber ?? "—"}</MonoValue></DetailRow>
      {detail.hash && <DetailRow label="Hash"><IdentityDisplay identity={detail.hash} /></DetailRow>}
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

function AmountDisplay({ amount, hide }: { amount: string; hide: boolean }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-display)" }}>
      {hide ? "••••••" : `${formatQu(amount)} QU`}
    </span>
  );
}

function MonoValue({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)" }}>{children}</span>;
}

function Dash() {
  return <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)" }}>—</span>;
}
