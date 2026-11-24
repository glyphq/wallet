import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { WalletAccountList } from "@/screens/wallets/wallet-account-list";

/** Account management surface reached from the header switcher's manage CTA. */
export default function AccountsScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const sessionAccounts = useSessionStore((s) => s.accounts);
  const { data: balances } = useWalletBalances();

  const walletId = searchParams.get("wallet");
  const wallet = wallets.find((item) => item.id === walletId)
    ?? wallets.find((item) => item.id === settings.activeWalletId)
    ?? wallets[0]
    ?? null;
  const isActiveWallet = wallet?.id === settings.activeWalletId;

  if (!wallet) return null;

  return (
    <AppShell
      contentStyle={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <section
        aria-label="Wallet"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Wallet
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", letterSpacing: "0.02em" }}>
          {wallet.name}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.05em" }}>
          {wallet.accounts.length} {wallet.accounts.length === 1 ? "ACCOUNT" : "ACCOUNTS"}
        </span>
      </section>

      <WalletAccountList
        accounts={wallet.accounts}
        isActive={isActiveWallet}
        activeAccountIndex={settings.activeAccountIndex}
        sessionWallets={sessionAccounts}
        balances={isActiveWallet ? balances : undefined}
        hideBalances={settings.hideBalances}
        onAdd={() => navigate(`/accounts/add?wallet=${wallet.id}`)}
        onManage={(account) => navigate(`/accounts/${account.index}?wallet=${wallet.id}`)}
      />
    </AppShell>
  );
}
