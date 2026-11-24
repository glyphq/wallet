import type { CSSProperties } from "react";
import { Identicon } from "@/components/identicon";
import { timeAgo } from "@/lib/format";
import type { usePersistedStore } from "@/store/persisted";

type Wallet = NonNullable<ReturnType<typeof usePersistedStore.getState>["wallets"][number]>;

/** The most recently used wallet, shown as the primary unlock target. */
export function LockWalletFocus({ wallet }: { wallet: Wallet }) {
  const lastOpened = wallet.lastUnlockedAt ? `Last unlocked ${timeAgo(wallet.lastUnlockedAt)}` : "Not unlocked yet";

  return (
    <div
      className="lock-wallet-focus corner-frame"
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-sharp)",
        background: "var(--color-bg-surface)",
      } as CSSProperties}
    >
      <Identicon
        kind="wallet"
        seed={`${wallet.id}:${wallet.color}`}
        label={wallet.name}
        size={44}
        radius={4}
        style={{ flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
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
    </div>
  );
}
