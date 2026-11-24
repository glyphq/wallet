import { Identicon } from "@/components/identicon";
import { timeAgo } from "@/lib/format";
import type { usePersistedStore } from "@/store/persisted";

type Wallet = NonNullable<ReturnType<typeof usePersistedStore.getState>["wallets"][number]>;

/** The most recently used wallet, shown as the primary unlock target. */
export function LockWalletFocus({ wallet }: { wallet: Wallet }) {
  const lastOpened = wallet.lastUnlockedAt ? `Last unlocked ${timeAgo(wallet.lastUnlockedAt)}` : "Not unlocked yet";

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
    </div>
  );
}
