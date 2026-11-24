import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { MoreHorizontalIcon, Search01Icon, LockKeyholeIcon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { IconButton } from "@/components/icon-button";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { ScreenHeader } from "@/components/screen-header";
import { ShellWalletSwitcher } from "@/components/shell-wallet-switcher";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { useOwnedAssets } from "@/hooks/use-owned-assets";
import { formatPreferredCurrencyFromQu } from "@/lib/format";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { AccountSelector } from "./dashboard-account-selector";
import { BalanceDisplay, OwnedAssetChips } from "./dashboard-balance";
import { MoreActions, PrimaryActions } from "./dashboard-actions";
import { RecentTxs } from "./dashboard-activity";

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigate = useNavigate();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);

  const isLocked = useSessionStore((s) => s.isLocked);
  const lock = useSessionStore((s) => s.lock);
  const accounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((v) => v.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const activeIndex = settings.activeAccountIndex;
  const identity = getWalletAccountIdentity(wallet, activeIndex, accounts);

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
      leading={<ShellWalletSwitcher />}
      title="Dashboard"
      action={
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
          <IconButton
            label="Lock wallet"
            framed
            onClick={() => {
              lock();
              navigate("/lock", { replace: true });
            }}
          >
            <LockKeyholeIcon size={19} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
          <IconButton label="Search" framed onClick={() => navigate("/search")}>
            <Search01Icon size={20} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
        </div>
      }
    />
  ), [lock, navigate]);

  return (
    <AppShell fullBleed>
      <section style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-base)" }}>
        <AsciiBackdrop
          style={{ minHeight: 300 }}
          contentStyle={{
            justifyContent: "flex-start",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-2) var(--screen-padding) var(--space-5)",
          }}
        >
          {dashboardHeader}

          <div className="asciify-clear" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <AccountSelector
              wallet={wallet}
              activeIndex={activeIndex}
              accounts={accounts}
              identity={identity}
              onSelect={setActiveAccountIndex}
            />
          </div>

          <div className="asciify-clear" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%" }}>
            <BalanceDisplay
              balance={balance?.balance}
              loading={balanceLoading}
              hidden={settings.hideBalances}
              fiatValue={balanceFiat}
              priceChange24h={priceChange24h}
            />
          </div>

          <div className="asciify-clear" style={{ width: "100%" }}>
            <OwnedAssetChips assets={ownedAssets ?? []} hidden={settings.hideBalances} />
          </div>

          <div className="asciify-clear">
            <PrimaryActions onSend={() => navigate("/send")} onReceive={() => navigate("/receive")} />
          </div>
        </AsciiBackdrop>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4)" }}>
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
