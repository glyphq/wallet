import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { animate } from "motion/react";
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
import { truncateId, formatQu, formatQuCompact, formatDate, formatUsdFromQu } from "@/lib/format";
import { qk } from "@/lib/query-keys";
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
    <span ref={spanRef} aria-live="polite" aria-atomic="true">
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
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
        [No account]
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
        {watchOnly && <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-warning)", letterSpacing: "0.05em" }}>WATCH</span>}
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
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
          {time}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: amountColor }}>
          {amount}
        </span>
        {amountUsd && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
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
    if (hasReady) queryClient.invalidateQueries({ queryKey: qk.txHistory(identity) });
  }, [lastProcessedTick, pendingTxs, identity, queryClient]);

  const myPending = pendingTxs
    .filter((p) => p.source === activeIdentity || p.destination === activeIdentity)
    .slice(0, 3);
  const recent = (txs ?? []).slice(0, 5 - Math.min(myPending.length, 3));
  const hasAny = myPending.length > 0 || recent.length > 0;

  if (isLoading && !hasAny) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
          Loading...
        </span>
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-6) 0", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
          No activity yet
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
          Transactions will appear here
        </span>
      </div>
    );
  }

  const items: React.ReactNode[] = [];

  myPending.forEach((p) => {
    const isIn = p.destination === activeIdentity;
    const expired = isExpired(p);
    const label = expired ? "Failed" : p.contractName ? "Pending" : "Pending";
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

    // Resolve procedure name for SC calls
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
        <div key={i}>
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
      <cfg.Icon size={14} color={cfg.color} />
    </div>
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

  useEffect(() => {
    if (isLocked) navigate("/lock", { replace: true });
  }, [isLocked, navigate]);

  const hasAlerts = txAlerts.length > 0;

  const statusBar = (
    <div style={{ display: "flex", alignItems: "center", position: "relative", width: "100%" }}>
      {/* Left: identicon */}
      <button
        onClick={() => navigate("/vaults")}
        aria-label={`Switch vault — ${vault?.name ?? "none"}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
        }}
      >
        {vault ? (
          <Identicon seed={`${vault.id}:${vault.color}`} size={28} radius={14} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: 14, background: "var(--color-bg-elevated)" }} />
        )}
      </button>

      {/* Center: title */}
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.02em", whiteSpace: "nowrap", pointerEvents: "none" }}>
        Home
      </span>

      {/* Right: eye + bell */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginLeft: "auto", flexShrink: 0 }}>
        <button
          onClick={() => updateSettings({ hideBalances: !settings.hideBalances })}
          aria-label={settings.hideBalances ? "Show balances" : "Hide balances"}
          style={{
            width: 28, height: 28,
            borderRadius: "50%",
            background: "var(--color-bg-elevated)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)",
          }}
        >
          {settings.hideBalances ? <EyeClosed size={14} weight="Linear" /> : <Eye size={14} weight="Linear" />}
        </button>
        <button
          onClick={() => navigate("/settings/notifications")}
          aria-label="Notifications"
          style={{
            position: "relative",
            width: 28, height: 28,
            borderRadius: "50%",
            background: "var(--color-bg-elevated)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)",
          }}
        >
          <Bell size={14} weight="Linear" />
          {hasAlerts && (
            <span style={{
              position: "absolute", top: 4, right: 4,
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--color-status-error)",
            }} />
          )}
        </button>
        <HealthBadge health={health} />
      </div>
    </div>
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

        {/* Hero: account + balance */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-6) 0 var(--space-4)" }}>
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
              {balanceLoading ? "Loading..." : balance ? <AnimatedBalance value={balance.balance} /> : "—"}
            </span>
          )}

          {balance && !balanceLoading && !settings.hideBalances && stats?.price && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              ≈ ${formatUsdFromQu(balance.balance, stats.price)} USD
            </span>
          )}

          {/* Owned assets chips */}
          {ownedAssets && ownedAssets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
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
                      padding: "3px 10px",
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
            <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
              <button
                onClick={() => navigate("/send")}
                className="glyph-btn"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                  height: 40, padding: "0 24px",
                  background: "var(--color-text-display)", color: "var(--color-bg-base)",
                  border: "none", borderRadius: "var(--radius-pill)",
                  fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500,
                  textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
                }}
              >
                <ArrowRightUp size={16} weight="Bold" />
                Send
              </button>
              <button
                onClick={() => navigate("/receive")}
                className="glyph-btn"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                  height: 40, padding: "0 24px",
                  background: "transparent", color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-pill)",
                  fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500,
                  textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
                }}
              >
                <QrCode size={16} weight="Bold" />
                Receive
              </button>
            </div>
          )}
        </div>

        {/* Recent activity card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: 24, padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Activity
            </span>
            <button
              onClick={() => navigate("/history")}
              aria-label="More options"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-disabled)", padding: 4, display: "flex", alignItems: "center" }}
            >
              <MenuDots size={14} weight="Linear" />
            </button>
          </div>
          <RecentTxs identity={identity} activeIdentity={identity} hideBalances={settings.hideBalances} price={stats?.price} />
        </div>

      </div>
    </AppShell>
  );
}
