import { Identicon } from "@/components/identicon";
import { timeAgo } from "@/lib/format";
import type { usePersistedStore } from "@/store/persisted";

type Wallet = NonNullable<ReturnType<typeof usePersistedStore.getState>["wallets"][number]>;

/** The most recently used wallet, shown as the primary unlock target. */
export function LockWalletFocus({ wallet }: { wallet: Wallet }) {
  const lastOpened = wallet.lastUnlockedAt ? `Last unlocked ${timeAgo(wallet.lastUnlockedAt)}` : "Not unlocked yet";
  const accountCount = wallet.accounts.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", textAlign: "center" }}>
      <Identicon
        kind="wallet"
        seed={`${wallet.id}:${wallet.color}`}
        label={wallet.name}
        size={96}
        radius={4}
        square
        ascii
        style={{ flexShrink: 0 }}
      />
      <span
        style={{
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-title)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
        }}
      >
        {wallet.name}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body-compact)",
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.02em",
        }}
      >
        {lastOpened}
      </span>

      <div
        className="lock-wallet-accounts corner-frame"
        style={{
          marginTop: "var(--space-2)",
          padding: "8px 14px",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-sharp)",
          background: "var(--color-bg-surface)",
          display: "flex",
          alignItems: "baseline",
          gap: "var(--space-2)",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body)", color: "var(--color-text-primary)" }}>
          {accountCount}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {accountCount === 1 ? "account" : "accounts"}
        </span>
      </div>
    </div>
  );
}
