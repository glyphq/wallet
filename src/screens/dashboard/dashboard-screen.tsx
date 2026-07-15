import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { animate } from "motion/react";
import { gesture } from "@/lib/animations";
import { AltArrowDown, Eye, EyeClosed, Bell, MenuDots, ArrowRightUp, QrCode, ShieldCheck, ShieldWarning, ShieldCross } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Divider } from "@/components/divider";
import { Identicon } from "@/components/identicon";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useNetworkHealth } from "@/hooks/use-network-health";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { useOwnedAssets } from "@/hooks/use-owned-assets";
import { Button } from "@/components/button";
import { truncateId, formatQu, formatQuCompact, formatDate, formatUsdFromQu } from "@/lib/format";
import { getVaultAccountIdentity, isWatchOnlyVault } from "@/lib/accounts";
import { KNOWN_CONTRACT_ADDRESSES, CONTRACT_PROCEDURE_NAMES, CONTRACT_NAMES } from "@/lib/contracts";

// ── Animated balance ─────────────────────────────────────────────────────────

function AnimatedBalance({ value }: { value: bigint }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<bigint | null>(null);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const num = Number(value);

  useEffect(() => {
    if (prevRef.current === null) {
      prevRef.current = value;
      if (spanRef.current) spanRef.current.textContent = formatQu(value);
      return;
    }
    const from = prevRef.current;
    prevRef.current = value;
    if (from > maxSafe || value > maxSafe) {
      if (spanRef.current) spanRef.current.textContent = formatQu(value);
      return;
    }
    const controls = animate(Number(from), num, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => {
        if (spanRef.current) spanRef.current.textContent = formatQu(v);
      },
      onComplete: () => {
        if (spanRef.current) spanRef.current.textContent = formatQu(value);
      },
    });
    return () => controls.stop();
  }, [num, value, maxSafe]);

  return (
    <span ref={spanRef} aria-live="polite" aria-atomic="true" style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatQu(value)}
    </span>
  );
}

// ── Account selector ─────────────────────────────────────────────────────────

function AccountSelector({ vault, activeIndex, wallets, identity, watchOnly, onSelect }: {
  vault: NonNullable<ReturnType<typeof usePersistedStore.getState>["vaults"][number]> | null;
  activeIndex: number;
  wallets: ReturnType<typeof useSessionStore.getState>["wallets"];
  identity: string | null;
  watchOnly: boolean;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visibleAccounts =
    vault?.accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index) ?? [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!identity) {
    return (
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
        No account
      </span>
    );
  }

  const accountName = vault?.accounts[activeIndex]?.name ?? `Account ${activeIndex + 1}`;

  if (visibleAccounts.length <= 1) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.02em" }}>
          {accountName}
        </span>
        {watchOnly && <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-status-warning)" }}>Watch-only</span>}
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.02em" }}>
          {accountName}
        </span>
        <AltArrowDown
          size={12}
          weight="Linear"
          style={{ color: "var(--color-text-disabled)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + var(--space-2))", left: 0, zIndex: 100,
            minWidth: 200, background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-card)", padding: "var(--space-1)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          {visibleAccounts.map((account) => {
            const isActive = account.index === activeIndex;
            const accIdentity = getVaultAccountIdentity(vault, account.index, wallets);
            return (
              <button
                key={account.index}
                onClick={() => { onSelect(account.index); setOpen(false); }}
                style={{
                  display: "flex", flexDirection: "column", gap: 2, width: "100%",
                  padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sharp)", border: "none",
                  background: isActive ? "var(--color-bg-surface)" : "transparent",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {account.name}
                </span>
                {accIdentity && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                    {truncateId(accIdentity)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Recent transactions ──────────────────────────────────────────────────────

function ActivityItem({ onClick, label, labelColor, address, time, amount, amountUsd, amountColor }: {
  onClick: () => void;
  label: string;
  labelColor: string;
  address: string;
  time: string;
  amount: string;
  amountUsd?: string;
  amountColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)",
        width: "100%", background: "none", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
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

function RecentTxs({ identity, activeIdentity, hideBalances, price }: {
  identity: string | null;
  activeIdentity: string | null;
  hideBalances: boolean;
  price?: number;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useTxHistory(identity);
  const txs = data?.pages[0];
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const { data: lastProcessedTickData } = useLastProcessedTick();
  const queryClient = useQueryClient();
  const lastProcessedTick = lastProcessedTickData?.tickNumber ?? 0;

  const isExpired = (p: { targetTick: number }) =>
    lastProcessedTick > 0 && lastProcessedTick >= p.targetTick;

  useEffect(() => {
    if (!lastProcessedTick || !identity) return;
    const hasReady = pendingTxs.some(
      (p) => (p.source === identity || p.destination === identity) && lastProcessedTick >= p.targetTick,
    );
    if (hasReady) queryClient.invalidateQueries({ queryKey: ["tx-history"] });
  }, [lastProcessedTick, pendingTxs, identity, queryClient]);

  const myPending = pendingTxs
    .filter((p) => p.source === activeIdentity || p.destination === activeIdentity)
    .slice(0, 3);
  const recent = (txs ?? []).slice(0, 5 - Math.min(myPending.length, 3));
  const hasAny = myPending.length > 0 || recent.length > 0;

  if (isLoading && !hasAny) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-3) 0" }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="skeleton" style={{ width: 80, height: 12 }} />
              <div className="skeleton" style={{ width: 120, height: 10 }} />
            </div>
            <div className="skeleton" style={{ width: 64, height: 12 }} />
          </div>
        ))}
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)", marginBottom: "var(--space-3)" }}>
          No transactions yet
        </div>
        <Button variant="secondary" shape="sharp" size="sm" onClick={() => navigate("/send")}>Send your first transaction</Button>
      </div>
    );
  }

  const items: React.ReactNode[] = [];

  myPending.forEach((p) => {
    const isIn = p.destination === activeIdentity;
    const expired = isExpired(p);
    const label = expired ? "Failed" : "Pending";
    const labelColor = expired ? "var(--color-status-error)" : "var(--color-status-warning)";
    const amountColor = expired ? "var(--color-text-disabled)" : "var(--color-status-warning)";
    const address = p.contractName ?? truncateId(isIn ? p.source : p.destination);
    items.push(
      <ActivityItem
        key={p.hash}
        onClick={() => navigate(`/tx/${p.hash}`)}
        label={label}
        labelColor={labelColor}
        address={address}
        time={formatDate(p.broadcastAt) || `Target tick ${p.targetTick}`}
        amount={hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(p.amount ?? "0")} QU`}
        amountColor={amountColor}
      />,
    );
  });

  recent.forEach((tx) => {
    const isIn = tx.destination === activeIdentity;
    const flew = tx.moneyFlew ?? true;
    const contractName = tx.destination ? KNOWN_CONTRACT_ADDRESSES[tx.destination] : undefined;
    const fromContract = tx.source ? KNOWN_CONTRACT_ADDRESSES[tx.source] : undefined;
    const isSc = !!(contractName || fromContract);

    const scAddress = contractName ? tx.destination : fromContract ? tx.source : null;
    const contractIndex = scAddress
      ? Object.entries(CONTRACT_NAMES).find(([, name]) => (contractName ?? fromContract) === name)?.[0]
      : null;
    const procedureName = contractIndex !== undefined && contractIndex !== null && tx.inputType !== null
      ? CONTRACT_PROCEDURE_NAMES[`${contractIndex}:${tx.inputType}`]
      : undefined;

    const label = !flew ? "Failed" : isSc ? (procedureName ?? contractName ?? "Contract call") : isIn ? "Received" : "Sent";
    const labelColor = !flew ? "var(--color-status-error)" : isIn ? "var(--color-accent)" : "var(--color-text-secondary)";
    const amountColor = flew
      ? isIn ? "var(--color-accent)" : "var(--color-text-display)"
      : "var(--color-text-disabled)";
    const amount = hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount ?? "0")} QU`;
    const amountUsd = !hideBalances && price ? `$${formatUsdFromQu(tx.amount ?? "0", price)}` : undefined;
    const address = isSc
      ? (contractName ?? fromContract ?? truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—")))
      : truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—"));
    items.push(
      <ActivityItem
        key={tx.hash}
        onClick={() => navigate(`/tx/${tx.hash}`)}
        label={label}
        labelColor={labelColor}
        address={address}
        time={formatDate(tx.timestamp) || `Tick ${tx.tickNumber}`}
        amount={amount}
        amountUsd={amountUsd}
        amountColor={amountColor}
      />,
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, i) => (
        <div key={i} className="stagger-item">
          {i > 0 && <Divider />}
          {item}
        </div>
      ))}
    </div>
  );
}

// ── Health badge ─────────────────────────────────────────────────────────────

const HEALTH_CONFIG: Record<string, { color: string; Icon: typeof ShieldCheck }> = {
  healthy: { color: "var(--color-status-success)", Icon: ShieldCheck },
  degraded: { color: "var(--color-status-warning)", Icon: ShieldWarning },
  offline: { color: "var(--color-status-error)", Icon: ShieldCross },
};

function HealthBadge({ health }: { health: string }) {
  const cfg = HEALTH_CONFIG[health] ?? HEALTH_CONFIG.offline;
  return (
    <div title={health} style={{ display: "flex" }}>
      <cfg.Icon size={12} color={cfg.color} />
    </div>
  );
}

// ── Header icon button ───────────────────────────────────────────────────────

function HeaderIcon({ onClick, label, children, badge }: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  badge?: boolean;
}) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      onClick={onClick}
      aria-label={label}
      style={{
        position: "relative",
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--color-bg-surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        color: "var(--color-text-secondary)",
      }}
    >
      {children}
      {badge && (
        <span style={{
          position: "absolute", top: 5, right: 5,
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--color-status-error)",
        }} />
      )}
    </motion.button>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigate = useNavigate();

  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  const isLocked = useSessionStore((s) => s.isLocked);
  const wallets = useSessionStore((s) => s.wallets);

  const vault = vaults.find((v) => v.id === settings.activeVaultId) ?? vaults[0] ?? null;
  const activeIndex = settings.activeAccountIndex;
  const identity = getVaultAccountIdentity(vault, activeIndex, wallets);
  const watchOnly = isWatchOnlyVault(vault);

  const { data: balance, isLoading: balanceLoading } = useBalance(identity);
  const health = useNetworkHealth();
  const { data: stats } = useLatestStats();
  const { data: ownedAssets } = useOwnedAssets(identity);
  const txAlerts = useSessionStore((s) => s.txAlerts);
  const priceSnapshots = usePersistedStore((s) => s.priceSnapshots);

  // Compute 24h price change from snapshots
  const priceChange24h = (() => {
    if (!stats?.price || priceSnapshots.length < 2) return null;
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    // Find the snapshot closest to 24h ago
    let closest = priceSnapshots[0];
    let minDiff = Math.abs(closest.timestamp - dayAgo);
    for (const snap of priceSnapshots) {
      const diff = Math.abs(snap.timestamp - dayAgo);
      if (diff < minDiff) { closest = snap; minDiff = diff; }
    }
    // Only use if within 6h window
    if (minDiff > 6 * 60 * 60 * 1000) return null;
    if (closest.priceUsd <= 0) return null;
    return ((stats.price - closest.priceUsd) / closest.priceUsd) * 100;
  })();

  useEffect(() => {
    if (isLocked) navigate("/lock", { replace: true });
  }, [isLocked, navigate]);

  const hasAlerts = txAlerts.length > 0;

  const statusBar = (
    <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "var(--space-2)" }}>
      {/* Left: vault identicon + name */}
      <button
        onClick={() => navigate("/vaults")}
        aria-label={`Switch vault — ${vault?.name ?? "none"}`}
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-2)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        {vault ? (
          <Identicon seed={`${vault.id}:${vault.color}`} size={26} radius={13} />
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: 13, background: "var(--color-bg-elevated)" }} />
        )}
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
          color: "var(--color-text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {vault?.name ?? "No vault"}
        </span>
        <HealthBadge health={health} />
      </button>

      {/* Right: eye + bell */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginLeft: "auto" }}>
        <HeaderIcon
          onClick={() => updateSettings({ hideBalances: !settings.hideBalances })}
          label={settings.hideBalances ? "Show balances" : "Hide balances"}
        >
          {settings.hideBalances ? <EyeClosed size={15} weight="Linear" /> : <Eye size={15} weight="Linear" />}
        </HeaderIcon>
        <HeaderIcon
          onClick={() => navigate("/settings/notifications")}
          label="Notifications"
          badge={hasAlerts}
        >
          <Bell size={15} weight="Linear" />
        </HeaderIcon>
      </div>
    </div>
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

        {/* Hero: account + balance */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-4) 0" }}>
          <AccountSelector
            vault={vault}
            activeIndex={activeIndex}
            wallets={wallets}
            identity={identity}
            watchOnly={watchOnly}
            onSelect={setActiveAccountIndex}
          />

          {/* Balance */}
          {settings.hideBalances ? (
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-disabled)", letterSpacing: "-0.02em" }}>
              ••••••
            </span>
          ) : (
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.02em" }}>
              {balanceLoading ? <div className="skeleton" style={{ width: 200, height: 48 }} /> : balance ? <AnimatedBalance value={balance.balance} /> : "—"}
            </span>
          )}

          {balance && !balanceLoading && !settings.hideBalances && stats?.price && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                ≈ ${formatUsdFromQu(balance.balance, stats.price)} USD
              </span>
              {priceChange24h !== null && (
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500,
                  color: priceChange24h >= 0 ? "var(--color-status-success)" : "var(--color-status-error)",
                  padding: "1px var(--space-2)", borderRadius: "var(--radius-pill)",
                  background: priceChange24h >= 0 ? "rgba(52,199,89,0.1)" : "rgba(255,59,48,0.1)",
                }}>
                  {priceChange24h >= 0 ? "+" : ""}{priceChange24h.toFixed(1)}%
                </span>
              )}
            </div>
          )}

          {/* Owned assets chips */}
          {ownedAssets && ownedAssets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
              {ownedAssets.map((asset) => {
                const amount = Number(asset.numberOfUnits);
                const decimals = asset.numberOfDecimalPlaces;
                const displayAmount = decimals > 0
                  ? (amount / Math.pow(10, decimals)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
                  : amount.toLocaleString();
                return (
                  <span
                    key={`${asset.issuanceIndex}-${asset.managingContractIndex}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
                      padding: "var(--space-1) var(--space-3)",
                      background: "var(--color-bg-surface)",
                      borderRadius: "var(--radius-pill)",
                      fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.04em",
                    }}
                  >
                    {settings.hideBalances ? "•••" : displayAmount} {asset.name}
                  </span>
                );
              })}
            </div>
          )}

          {/* CTA buttons */}
          {!watchOnly && (
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
              <Button variant="primary" size="md" shape="pill" onClick={() => navigate("/send")}>
                <ArrowRightUp size={16} weight="Bold" />
                Send
              </Button>
              <Button variant="secondary" size="md" shape="pill" onClick={() => navigate("/receive")}>
                <QrCode size={16} weight="Bold" />
                Receive
              </Button>
            </div>
          )}
        </div>

        {/* Recent activity card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              Recent activity
            </span>
            <button
              onClick={() => navigate("/history")}
              aria-label="View all activity"
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                color: "var(--color-text-secondary)", padding: 0,
                display: "flex", alignItems: "center", gap: "var(--space-1)",
              }}
            >
              View all
              <MenuDots size={14} weight="Linear" />
            </button>
          </div>
          <RecentTxs identity={identity} activeIdentity={identity} hideBalances={settings.hideBalances} price={stats?.price} />
        </div>

      </div>
    </AppShell>
  );
}
