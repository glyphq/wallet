import { Identicon } from "@/components/identicon";
import { formatDate, timeAgo } from "@/lib/format";
import type { usePersistedStore } from "@/store/persisted";

type Wallet = NonNullable<ReturnType<typeof usePersistedStore.getState>["wallets"][number]>;

/** The most recently used wallet, shown as the primary unlock target. */
export function LockWalletFocus({ wallet }: { wallet: Wallet }) {
  const lastOpened = wallet.lastUnlockedAt ? `Last unlocked ${timeAgo(wallet.lastUnlockedAt)}` : "Not unlocked yet";
  const accountCount = wallet.accounts.length;
  const createdAt = wallet.createdAt ? formatDate(wallet.createdAt) : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", textAlign: "center" }}>
      <Identicon
        kind="wallet"
        seed={`${wallet.id}:${wallet.color}`}
        label={wallet.name}
        size={64}
        radius={4}
        square
        style={{ flexShrink: 0 }}
      />
      <span
        style={{
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-section)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
        }}
      >
        {wallet.name}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-sm)",
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.02em",
        }}
      >
        {lastOpened}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-2)" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Accounts
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
            {accountCount}
          </span>
        </span>
        <span aria-hidden="true" style={{ width: 1, height: 24, background: "var(--color-border-subtle)" }} />
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Created
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
            {createdAt}
          </span>
        </span>
      </div>
    </div>
  );
}
