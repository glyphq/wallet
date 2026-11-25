import { IconButton } from "@/components/icon-button";
import { Identicon } from "@/components/identicon";
import { Delete02Icon } from "@/lib/icons";
import { timeAgo } from "@/lib/format";
import type { usePersistedStore } from "@/store/persisted";

type Wallet = NonNullable<ReturnType<typeof usePersistedStore.getState>["wallets"][number]>;

function WalletShelfRow({
  wallet,
  selected,
  onSelect,
  onDelete,
  isLast,
}: {
  wallet: Wallet;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isLast: boolean;
}) {
  const lastOpened = wallet.lastUnlockedAt ? `Last unlocked ${timeAgo(wallet.lastUnlockedAt)}` : "Not unlocked yet";

  return (
    <div
      className="wallet-shelf-row"
      data-selected={selected ? "true" : "false"}
      style={{
        width: "100%",
        minHeight: 60,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-2) var(--space-2) var(--space-4)",
        borderBottom: isLast ? "none" : "1px solid var(--color-border-subtle)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-sans)",
        opacity: selected ? 1 : 0.58,
        transition: "background var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${wallet.name}. ${lastOpened}`}
        style={{
          minWidth: 0,
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-2) 0",
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-sans)",
        }}
      >
        <Identicon kind="wallet" seed={`${wallet.id}:${wallet.color}`} label={wallet.name} size={36} padding={2} walletIcon={wallet.icon} walletColor={wallet.color} />
        <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "var(--text-body)",
              fontWeight: 600,
            }}
          >
            {wallet.name}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.02em" }}>
            {lastOpened}
          </span>
        </span>
      </button>
      <IconButton
        label={`Delete ${wallet.name}`}
        onClick={onDelete}
        style={{ width: 34, height: 34, flexShrink: 0, color: "var(--color-text-tertiary)" }}
      >
        <Delete02Icon size={16} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

export function LockWalletShelf({
  wallets,
  selectedId,
  onSelect,
  onDelete,
}: {
  wallets: Wallet[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete: (wallet: Wallet) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div
        role="group"
        aria-label="Choose a wallet to unlock"
        className="lock-wallet-list corner-frame"
        style={{
          maxHeight: wallets.length > 3 ? 194 : undefined,
          overflowY: wallets.length > 3 ? "auto" : "hidden",
        }}
      >
        {wallets.map((wallet, index) => (
          <WalletShelfRow
            key={wallet.id}
            wallet={wallet}
            selected={wallet.id === selectedId}
            isLast={index === wallets.length - 1}
            onSelect={() => onSelect(wallet.id)}
            onDelete={() => onDelete(wallet)}
          />
        ))}
      </div>
    </div>
  );
}
