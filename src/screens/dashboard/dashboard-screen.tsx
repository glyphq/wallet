import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { IconButton } from "@/components/icon-button";
import { ScreenHeader } from "@/components/screen-header";
import { ShellAccountSwitcher } from "@/components/shell-account-switcher";
import { SafeIcon } from "@/lib/icons";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useStreamingTick } from "@/hooks/use-streaming-tick";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { useOwnedAssets } from "@/hooks/use-owned-assets";
import { formatPreferredCurrencyFromQu, formatQu } from "@/lib/format";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { BalanceDisplay } from "@/components/balance-display";
import { OwnedAssetChips } from "./dashboard-balance";
import { PrimaryActions } from "./dashboard-actions";
import { RecentTxs } from "./dashboard-activity";

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const navigate = useNavigate();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);

  const isLocked = useSessionStore((s) => s.isLocked);
  const accounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((v) => v.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const activeIndex = settings.activeAccountIndex;
  const identity = getWalletAccountIdentity(wallet, activeIndex, accounts);

  const { data: balance, isLoading: balanceLoading } = useBalance(identity);
  const streamingTick = useStreamingTick();
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
      leading={<ShellAccountSwitcher />}
      title="Dashboard"
      action={(
        <IconButton label="Multisig vaults" onClick={() => navigate("/multisig")}>
          <SafeIcon size={20} aria-hidden="true" />
        </IconButton>
      )}
    />
  ), [navigate]);

  return (
    <AppShell statusBar={dashboardHeader} fullBleed>
      <section style={{ borderBottom: "1px solid var(--color-border-subtle)", background: "var(--color-bg-base)" }}>
        <AsciiBackdrop
          style={{ minHeight: 260 }}
          contentStyle={{
            justifyContent: "flex-start",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-4) var(--screen-padding) var(--space-5)",
          }}
        >
          <div className="asciify-clear" style={{ minHeight: 18, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", fontVariantNumeric: "tabular-nums" }}>
            {streamingTick === null ? "—" : formatQu(streamingTick)}
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
        <div className="recent-activity-panel corner-frame">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", fontWeight: 500, color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Recent activity
            </span>
          </div>
          <RecentTxs identity={identity} activeIdentity={identity} hideBalances={settings.hideBalances} price={stats?.price} />
        </div>

      </div>
    </AppShell>
  );
}
