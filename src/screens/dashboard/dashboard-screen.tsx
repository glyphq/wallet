import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { animate } from "motion/react";
import { AltArrowDown, Bolt, Eye, EyeClosed, Magnifer, MultipleForwardRight } from "@solar-icons/react";
import { BottomNav } from "@/components/bottom-nav";
import { AppShell } from "@/layouts/app-shell";
import { Modal } from "@/components/modal";
import { IdentityDisplay } from "@/components/identity-display";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { useLastProcessedTick } from "@/hooks/use-last-processed-tick";
import { useNetworkHealth } from "@/hooks/use-network-health";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { Divider } from "@/components/divider";
import { truncateId, formatQu, formatQuCompact, formatUsdFromQu } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { Identicon } from "@/components/identicon";
import { getVaultAccountIdentity, isWatchOnlyVault } from "@/lib/accounts";

const HEALTH_COLOR: Record<string, string> = {
  healthy: "var(--color-status-success)",
  degraded: "var(--color-status-warning)",
  offline: "var(--color-status-error)",
};



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
  }, [num, value, maxSafe]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={spanRef} aria-live="polite" aria-atomic="true">
      {formatQu(value)}
    </span>
  );
}

function padTick(tick: number | undefined): string {
  if (!tick) return "--------";
  return tick.toString().padStart(8, "0");
}

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
  const { data: tickInfo, dataUpdatedAt } = useTickInfo();
  const health = useNetworkHealth();
  const { data: stats } = useLatestStats();
  const txAlerts = useSessionStore((s) => s.txAlerts);
  const dismissTxAlert = useSessionStore((s) => s.dismissTxAlert);

  const [showNetworkOverlay, setShowNetworkOverlay] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Close account dropdown on outside click
  useEffect(() => {
    if (!accountDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [accountDropdownOpen]);

  useEffect(() => {
    if (isLocked) navigate("/lock", { replace: true });
  }, [isLocked, navigate]);

  const visibleAccounts =
    vault?.accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index) ?? [];

  const statusBar = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={() => navigate("/vaults")}
        aria-label={`Switch vault — ${vault?.name ?? "none"}`}
        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {vault ? (
          <>
            <Identicon seed={`${vault.id}:${vault.color}`} size={18} radius={3} />
          </>
        ) : (
          <div style={{ width: 18, height: 18, borderRadius: 3, background: "var(--color-text-disabled)" }} />
        )}
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {vault?.name ?? "—"}
        </span>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        <button
          onClick={() => navigate("/search")}
          aria-label="Search"
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-text-disabled)" }}
        >
          <Magnifer size={14} weight="Linear" />
        </button>
        <button
          onClick={() => setShowNetworkOverlay(true)}
          aria-label="Network status"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <div
            title={health === "healthy" ? "Network healthy" : health === "degraded" ? "Network degraded" : "Network offline"}
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: HEALTH_COLOR[health],
            }}
          />
        </button>
      </div>
    </div>
  );

  return (
    <AppShell statusBar={statusBar} bottomNav={<BottomNav active="home" />} contentStyle={{ padding: "var(--space-6)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>

        {/* Failed/expired tx alerts */}
        {txAlerts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {txAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                    {alert.reason === "expired" ? "Tick missed" : "Transaction failed"} — {alert.label}
                  </span>
                </div>
                <button
                  onClick={() => dismissTxAlert(alert.id)}
                  aria-label="Dismiss"
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", padding: 0, flexShrink: 0 }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Account selector dropdown */}
        {identity && visibleAccounts.length > 1 ? (
          <div ref={accountDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setAccountDropdownOpen((prev) => !prev)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-1)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                {vault?.accounts[activeIndex]?.name ?? `Account ${activeIndex + 1}`}
              </span>
              <AltArrowDown
                size={14}
                weight="Linear"
                style={{
                  color: "var(--color-text-disabled)",
                  transform: accountDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              />
            </button>
            {accountDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + var(--space-2))",
                  left: 0,
                  zIndex: 100,
                  minWidth: 240,
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-1)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                }}
              >
                {visibleAccounts.map((account) => {
                  const isActive = account.index === activeIndex;
                  const accIdentity = getVaultAccountIdentity(vault, account.index, wallets);
                  return (
                    <button
                      key={account.index}
                      onClick={() => {
                        setActiveAccountIndex(account.index);
                        setAccountDropdownOpen(false);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        width: "100%",
                        padding: "var(--space-3) var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        border: "none",
                        background: isActive ? "var(--color-bg-surface)" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
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
            {watchOnly && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)", marginTop: "var(--space-2)" }}>
                Watch only
              </div>
            )}
            <div style={{ marginTop: "var(--space-2)" }}>
              <IdentityDisplay identity={identity} />
            </div>
          </div>
        ) : identity ? (
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
              {vault?.accounts[activeIndex]?.name ?? `Account ${activeIndex + 1}`}
            </div>
            {watchOnly && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)", marginBottom: "var(--space-2)" }}>
                Watch only
              </div>
            )}
            <IdentityDisplay identity={identity} />
          </div>
        ) : (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            [No account]
          </div>
        )}

        {/* Balance hero */}
        <div style={{ textAlign: "center", padding: "var(--space-8) 0", position: "relative" }}>
          <button
            onClick={() => updateSettings({ hideBalances: !settings.hideBalances })}
            aria-label={settings.hideBalances ? "Show balances" : "Hide balances"}
            style={{ position: "absolute", top: 0, right: 0, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-disabled)", padding: 0, display: "flex", alignItems: "center" }}
          >
            {settings.hideBalances ? <EyeClosed size={14} weight="Linear" /> : <Eye size={14} weight="Linear" />}
          </button>
          {settings.hideBalances ? (
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "var(--text-display)", color: "var(--color-text-disabled)" }}>
              ••••••
            </span>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.02em" }}>
                {balanceLoading ? "Loading..." : balance ? <AnimatedBalance value={balance.balance} /> : "—"}
              </span>
              {!balanceLoading && balance && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)" }}>
                  QU
                </span>
              )}
            </div>
          )}

          {balance && !balanceLoading && !settings.hideBalances && stats?.price && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", marginTop: "var(--space-1)", letterSpacing: "0.05em" }}>
              ≈ ${formatUsdFromQu(balance.balance, stats.price)} USD
            </div>
          )}
          {balance && !balanceLoading && settings.lowBalanceThreshold && (() => {
            try {
              const threshold = BigInt(settings.lowBalanceThreshold);
              if (threshold > 0n && balance.balance < threshold) {
                return (
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)", marginTop: "var(--space-2)" }}>
                    Low balance
                  </div>
                );
              }
            } catch { /* ignore bad threshold */ }
            return null;
          })()}
        </div>



        {/* Recent transactions */}
        <RecentTxs identity={identity} activeIdentity={identity} hideBalances={settings.hideBalances} onViewAll={() => navigate("/history")} />

        {/* Utility shortcuts */}
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)" }}>
          <button onClick={() => navigate("/stake")} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", background: "none", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-pill)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", padding: "var(--space-2) var(--space-4)" }}>
            <Bolt size={14} weight="Linear" />
            Qearn
          </button>
          <button onClick={() => navigate("/send-many")} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", background: "none", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-pill)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", padding: "var(--space-2) var(--space-4)" }}>
            <MultipleForwardRight size={14} weight="Linear" />
            Send many
          </button>
        </div>

      </div>

      {/* Network health overlay */}
      <Modal open={showNetworkOverlay} onClose={() => setShowNetworkOverlay(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Network
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                {health}
              </span>
            </div>
          </div>
          <NetworkRow label="RPC" value={settings.network.liveApiUrl} />
          <NetworkRow label="Tick" value={tickInfo?.tick ? `#${padTick(tickInfo.tick)}` : "—"} />
          <NetworkRow
            label="Updated"
            value={dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
          />
          <div style={{ display: "flex", gap: "var(--space-4)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--color-border-subtle)" }}>
            {(["healthy", "degraded", "offline"] as const).map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: HEALTH_COLOR[s], flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", textTransform: "capitalize" }}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

interface RecentTxsProps {
  identity: string | null;
  activeIdentity: string | null;
  hideBalances: boolean;
  onViewAll: () => void;
}

function RecentTxs({ identity, activeIdentity, hideBalances, onViewAll }: RecentTxsProps) {
  const { data, isLoading } = useTxHistory(identity);
  const txs = data?.pages[0];
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const removePendingTx = usePersistedStore((s) => s.removePendingTx);
  const { data: lastProcessedTickData } = useLastProcessedTick();
  const queryClient = useQueryClient();
  const lastProcessedTick = lastProcessedTickData?.tickNumber ?? 0;

  const isExpired = (p: { targetTick: number }) =>
    lastProcessedTick > 0 && lastProcessedTick >= p.targetTick;

  // When any pending tx's target tick is processed, immediately refresh history
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
  const expiredPending = myPending.filter(isExpired);

  const recent = (txs ?? []).slice(0, 5 - Math.min(myPending.length, 3));
  const hasAny = myPending.length > 0 || recent.length > 0;

  if (isLoading && !hasAny) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
          Loading...
        </span>
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) 0", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
          No transactions yet
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
          Send or receive QU to get started
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {myPending.map((p, i) => {
        const isIn = p.destination === activeIdentity;
        const expired = isExpired(p);
        return (
          <div key={p.hash}>
            {i > 0 && <Divider style={{ marginBottom: "var(--space-3)" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: expired ? "var(--color-status-error)" : "var(--color-status-warning)" }}>
                  {expired ? "Failed" : "Pending"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                  {truncateId(isIn ? p.source : p.destination)}
                </span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: expired ? "var(--color-text-disabled)" : "var(--color-status-warning)" }}>
                {hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(p.amount ?? "0")}`}
              </span>
            </div>
          </div>
        );
      })}

      {recent.map((tx, i) => {
        const isIn = tx.destination === activeIdentity;
        const flew = tx.moneyFlew ?? true;
        const amountColor = flew
          ? isIn ? "var(--color-status-success)" : "var(--color-text-primary)"
          : "var(--color-text-disabled)";
        const offset = myPending.length + i;
        return (
          <div key={tx.hash}>
            {offset > 0 && <Divider style={{ marginBottom: "var(--space-3)" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: flew ? (isIn ? "var(--color-status-success)" : "var(--color-text-secondary)") : "var(--color-status-error)" }}>
                  {flew ? (isIn ? "Received" : "Sent") : "Failed"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                  {truncateId(isIn ? (tx.source ?? "—") : (tx.destination ?? "—"))}
                </span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: amountColor }}>
                {hideBalances ? "••••••" : `${isIn ? "+" : "−"}${formatQuCompact(tx.amount ?? "0")}`}
              </span>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {expiredPending.length > 0 ? (
          <button
            onClick={() => expiredPending.forEach((p) => removePendingTx(p.hash))}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0" }}
          >
            Clear expired
          </button>
        ) : <span />}
        <button
          onClick={onViewAll}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0" }}
        >
          View all →
        </button>
      </div>
    </div>
  );
}

function NetworkRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: warn ? "var(--color-status-warning)" : "var(--color-text-primary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}
