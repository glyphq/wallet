import { useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { FramedAvatar } from "@/components/framed-avatar";
import { MAX_WALLET_ACCOUNTS, useWalletBalances } from "@/hooks/use-wallet-balances";
import { getAccountIdentity } from "@/lib/accounts";
import { formatQu, truncateId } from "@/lib/format";
import { AddCircleIcon, File02Icon } from "@/lib/icons";
import { usePersistedStore, type AccountMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

function AccountRow({
  account,
  identity,
  isCurrent,
  balance,
  hideBalances,
  onOpen,
}: {
  account: AccountMeta;
  identity: string | null;
  isCurrent: boolean;
  balance: bigint | null;
  hideBalances: boolean;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={isCurrent ? "corner-frame" : undefined}
      aria-label={`Manage ${account.name}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        minHeight: 64,
        padding: "var(--space-3)",
        border: 0,
        borderRadius: "var(--radius-sharp)",
        background: isCurrent
          ? "var(--color-bg-surface)"
          : hovered
            ? "var(--color-bg-elevated)"
            : "transparent",
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-out)",
        "--corner-color": "var(--color-accent)",
        "--corner-size": "10px",
        "--corner-inset": "3px",
      } as CSSProperties}
    >
      <FramedAvatar seed={identity ?? account.name} size={34} />
      <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {account.name}
        </span>
        {identity ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.04em" }}>
            {truncateId(identity, 8, 8)}
          </span>
        ) : null}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
        {balance !== null ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {hideBalances ? "••••••" : `${formatQu(balance)} QU`}
          </span>
        ) : null}
      </span>
    </button>
  );
}

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

  const accounts = wallet.accounts.slice().sort((a, b) => a.index - b.index);
  const atLimit = wallet.accounts.length >= MAX_WALLET_ACCOUNTS;

  function openAccount(account: AccountMeta) {
    navigate(`/accounts/${account.index}?wallet=${wallet!.id}`);
  }

  return (
    <AppShell
      fullBleed
      contentStyle={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          width: "100%",
          maxWidth: 720,
          margin: "0 auto",
          padding: "var(--space-4)",
        }}
      >
        <span style={{ alignSelf: "flex-start", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Accounts
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {accounts.map((account) => {
            const identity = getAccountIdentity(account, isActiveWallet ? (sessionAccounts[account.index] ?? null) : null);
            return (
              <AccountRow
                key={account.index}
                account={account}
                identity={identity}
                isCurrent={isActiveWallet && settings.activeAccountIndex === account.index}
                balance={isActiveWallet && identity ? balances?.[identity] ?? null : null}
                hideBalances={settings.hideBalances}
                onOpen={() => openAccount(account)}
              />
            );
          })}
        </div>

      </div>

      <footer style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--space-4) var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%", maxWidth: 720, margin: "0 auto" }}>
          <Button
            variant="secondary"
            size="md"
            style={{ width: "100%" }}
            disabled={!wallet.encryptedData}
            onClick={() => navigate(`/accounts/export?wallet=${wallet.id}`)}
          >
            <File02Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            Export vault
          </Button>
          <Button
            size="md"
            style={{ width: "100%" }}
            disabled={atLimit}
            onClick={() => navigate(`/accounts/add?wallet=${wallet.id}`)}
          >
            <AddCircleIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            Add account
          </Button>
        </div>
      </footer>
    </AppShell>
  );
}
