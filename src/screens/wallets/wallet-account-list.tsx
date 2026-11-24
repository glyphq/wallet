import { useState } from "react";
import { Button } from "@/components/button";
import { MAX_WALLET_ACCOUNTS } from "@/hooks/use-wallet-balances";
import { getAccountIdentity } from "@/lib/accounts";
import { AddCircleIcon } from "@/lib/icons";
import type { SessionAccount } from "@/lib/session-account";
import type { AccountMeta } from "@/store/persisted";
import { AccountRow } from "./wallet-detail-parts";

interface WalletAccountListProps {
  accounts: AccountMeta[];
  isActive: boolean;
  activeAccountIndex: number;
  sessionWallets: SessionAccount[];
  balances: Record<string, bigint> | undefined;
  hideBalances: boolean;
  onAdd: () => void;
  onManage: (account: AccountMeta) => void;
}

/** Visible and hidden account rows for a wallet, plus the add-account affordance. */
export function WalletAccountList({
  accounts,
  isActive,
  activeAccountIndex,
  sessionWallets,
  balances,
  hideBalances,
  onAdd,
  onManage,
}: WalletAccountListProps) {
  const [showHidden, setShowHidden] = useState(false);

  const visible = accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index);
  const hidden = accounts.filter((a) => a.hidden).sort((a, b) => a.index - b.index);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {accounts.length < MAX_WALLET_ACCOUNTS ? (
          <Button variant="secondary" shape="sharp" size="sm" onClick={onAdd} style={{ width: "auto" }}>
            <AddCircleIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            Add account
          </Button>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.05em", alignSelf: "center" }}>
            16 MAX
          </span>
        )}
      </div>
      {visible.length === 0 && hidden.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
            No accounts in this wallet
          </div>
          <Button variant="secondary" shape="sharp" size="sm" style={{ width: "auto" }} onClick={onAdd}>
            Add your first account
          </Button>
        </div>
      )}

      {visible.map((account) => (
        <AccountRow
          key={account.index}
          account={account}
          identity={getAccountIdentity(account, isActive ? (sessionWallets[account.index] ?? null) : null)}
          isCurrent={isActive && activeAccountIndex === account.index}
          balance={isActive && balances ? balances[getAccountIdentity(account, sessionWallets[account.index] ?? null) ?? ""] ?? null : null}
          hideBalances={hideBalances}
          onManage={() => onManage(account)}
        />
      ))}

      {hidden.length > 0 && (
        <button
          onClick={() => setShowHidden((v) => !v)}
          style={{
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-sharp)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-text-disabled)",
            letterSpacing: "0.05em",
            padding: "var(--space-3) var(--space-4)",
            textAlign: "left",
          }}
        >
          {showHidden ? "▾" : "▸"} {hidden.length} hidden {hidden.length === 1 ? "account" : "accounts"}
        </button>
      )}

      {showHidden && hidden.map((account) => (
        <AccountRow
          key={account.index}
          account={account}
          identity={getAccountIdentity(account, isActive ? (sessionWallets[account.index] ?? null) : null)}
          dimmed
          isCurrent={false}
          hideBalances={hideBalances}
          onManage={() => onManage(account)}
        />
      ))}
    </>
  );
}
