import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { MoreHorizontalIcon, Search01Icon, LockKeyholeIcon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { IconButton } from "@/components/icon-button";
import { ScreenHeader } from "@/components/screen-header";
import { ShellVaultSwitcher } from "@/components/shell-vault-switcher";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { useOwnedAssets } from "@/hooks/use-owned-assets";
import { formatPreferredCurrencyFromQu } from "@/lib/format";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { AccountSelector } from "./dashboard-account-selector";
import { BalanceDisplay, OwnedAssetChips } from "./dashboard-balance";
import { MoreActions, PrimaryActions } from "./dashboard-actions";
import { RecentTxs } from "./dashboard-activity";

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigate = useNavigate();

  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);

  const isLocked = useSessionStore((s) => s.isLocked);
  const lock = useSessionStore((s) => s.lock);
  const wallets = useSessionStore((s) => s.wallets);

  const vault = vaults.find((v) => v.id === settings.activeVaultId) ?? vaults[0] ?? null;
  const activeIndex = settings.activeAccountIndex;
  const identity = getVaultAccountIdentity(vault, activeIndex, wallets);

  const { data: balance, isLoading: balanceLoading } = useBalance(identity);
  const { data: stats } = useLatestStats();
  const { data: ownedAssets } = useOwnedAssets(identity);
  const quote = usePreferredCurrencyQuote();
  const balanceFiat =
    balance && stats?.price
      ? formatPreferredCurrencyFromQu(balance.balance, { usdPrice: stats.price, ...quote }).text
      : undefined;
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

  const dashboardHeader = useMemo(() => (
    <ScreenHeader
      leading={<ShellVaultSwitcher />}
      title="Dashboard"
      action={
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <IconButton
            label="Lock Vault"
            onClick={() => {
              lock();
              navigate("/lock", { replace: true });
            }}
          >
            <LockKeyholeIcon size={19} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
          <IconButton label="Search" onClick={() => navigate("/search")}>
            <Search01Icon size={20} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
        </div>
      }
    />
  ), [lock, navigate]);

  return (
    <AppShell statusBar={dashboardHeader} contentStyle={{ padding: "var(--space-4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

        {/* Hero: account + balance */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-4) 0" }}>
          <AccountSelector
            vault={vault}
            activeIndex={activeIndex}
            wallets={wallets}
            identity={identity}
            onSelect={setActiveAccountIndex}
          />

          <BalanceDisplay
            balance={balance?.balance}
            loading={balanceLoading}
            hidden={settings.hideBalances}
            fiatValue={balanceFiat}
            priceChange24h={priceChange24h}
          />

          <OwnedAssetChips assets={ownedAssets ?? []} hidden={settings.hideBalances} />

          <PrimaryActions onSend={() => navigate("/send")} onReceive={() => navigate("/receive")} />
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
              <MoreHorizontalIcon size={14} strokeWidth={1.5} />
            </button>
          </div>
          <RecentTxs identity={identity} activeIdentity={identity} hideBalances={settings.hideBalances} price={stats?.price} />
        </div>

        <MoreActions onStake={() => navigate("/stake")} onSendMany={() => navigate("/send-many")} />

      </div>
    </AppShell>
  );
}
