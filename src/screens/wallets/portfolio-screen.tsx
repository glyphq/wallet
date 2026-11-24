import { useNavigate, useParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { AsciiReveal, AsciiSkeleton } from "ascii-reveal";
import { Divider } from "@/components/divider";
import { Identicon } from "@/components/identicon";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { formatQu, formatPreferredCurrencyFromQu } from "@/lib/format";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { DistributionBar, PortfolioAccountRow } from "./portfolio-parts";

export default function PortfolioScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === id));
  const hideBalances = usePersistedStore((s) => s.settings.hideBalances);
  const accounts = useSessionStore((s) => s.accounts);
  const { data: balances, isLoading } = useWalletBalances();
  const { data: stats } = useLatestStats();
  const quote = usePreferredCurrencyQuote();

  if (!wallet) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.08em" }}>
          [wallet not found]
        </div>
      </AppShell>
    );
  }

  const visibleAccounts = wallet.accounts.filter((a) => !a.hidden);

  const accountsWithBalance = visibleAccounts.map((account) => {
    const identity = getWalletAccountIdentity(wallet, account.index, accounts);
    const balance = identity ? (balances?.[identity] ?? null) : null;
    return { account, identity, balance };
  });

  const totalBalance = accountsWithBalance.reduce(
    (sum, { balance }) => sum + (balance ?? 0n),
    0n,
  );

  const allLoaded = !isLoading && balances !== undefined;

  return (
    <AppShell contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <Identicon kind="wallet" seed={`${wallet.id}:${wallet.color}`} label={wallet.name} size={36} style={{ flexShrink: 0 }} walletIcon={wallet.icon} walletColor={wallet.color} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {wallet.name}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/accounts/${id}`)}
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label)",
              color: "var(--color-text-secondary)",
            }}
          >
            View wallet details
          </button>
        </div>
      </div>

      {/* ── Total balance ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          Total balance
        </span>
        <AsciiReveal
          loading={!allLoaded}
          revealOnMount={false}
          shimmer={false}
          duration="fast"
          style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "var(--text-display)", letterSpacing: "-0.02em", color: "var(--color-text-display)" }}>
            {!allLoaded ? (
              <AsciiSkeleton as="span" variant="scan" rows={4} width={200} height={48} animate={false} />
            ) : hideBalances ? "••••••" : formatQu(totalBalance)}
          </span>
          {allLoaded && !hideBalances && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-disabled)" }}>QU</span>
          )}
        </AsciiReveal>
        {allLoaded && !hideBalances && stats?.price && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
            {formatPreferredCurrencyFromQu(totalBalance, { usdPrice: stats.price, ...quote }).text}
          </span>
        )}
      </div>

      {/* ── Distribution bar ── */}
      {allLoaded && totalBalance > 0n && !hideBalances && (
        <DistributionBar accounts={accountsWithBalance} total={totalBalance} />
      )}

      <Divider />

      {/* ── Account list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          Accounts ({visibleAccounts.length})
        </span>

        {accountsWithBalance.map((entry, i) => (
          <PortfolioAccountRow
            key={entry.account.index}
            entry={entry}
            position={i}
            total={totalBalance}
            allLoaded={allLoaded}
            hideBalances={hideBalances}
          />
        ))}
      </div>
    </AppShell>
  );
}
