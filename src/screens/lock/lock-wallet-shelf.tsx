import { AddCircleIcon, CheckmarkCircle01Icon } from "@/lib/icons";
import { Identicon } from "@/components/identicon";
import { timeAgo } from "@/lib/format";
import type { usePersistedStore } from "@/store/persisted";

type Wallet = NonNullable<ReturnType<typeof usePersistedStore.getState>["wallets"][number]>;

function WalletShelfRow({
  wallet,
  selected,
  onSelect,
  isLast,
}: {
  wallet: Wallet;
  selected: boolean;
  onSelect: () => void;
  isLast: boolean;
}) {
  const lastOpened = wallet.lastUnlockedAt ? `Last unlocked ${timeAgo(wallet.lastUnlockedAt)}` : "Not unlocked yet";

  return (
    <button
      type="button"
      className="wallet-shelf-row"
      data-selected={selected ? "true" : "false"}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${wallet.name}. ${lastOpened}`}
      style={{
        width: "100%",
        minHeight: 60,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid var(--color-border-subtle)",
        color: "var(--color-text-primary)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-sans)",
        transition: "background var(--duration-fast) var(--ease-out)",
      }}
    >
      <Identicon kind="wallet" seed={`${wallet.id}:${wallet.color}`} label={wallet.name} size={36} radius={4} padding={2} walletIcon={wallet.icon} walletColor={wallet.color} />
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
      {selected ? <CheckmarkCircle01Icon size={18} aria-hidden="true" style={{ color: "var(--color-text-secondary)", flexShrink: 0 }} /> : null}
    </button>
  );
}

export function LockWalletShelf({
  wallets,
  selectedId,
  onSelect,
  onAdd,
}: {
  wallets: Wallet[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
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
          />
        ))}
      </div>
      <button
        type="button"
        className="wallet-shelf-add"
        onClick={onAdd}
        aria-label="Add another wallet"
        style={{
          width: "100%",
          minHeight: 54,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          border: "1px dashed var(--color-border-subtle)",
          borderRadius: "var(--radius-sharp)",
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
          color: "var(--color-text-secondary)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            border: "1px dashed var(--color-border-strong)",
            borderRadius: "var(--radius-sharp)",
            color: "var(--color-text-tertiary)",
          }}
        >
          <AddCircleIcon size={17} strokeWidth={1.5} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span style={{ fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
            Add another wallet
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            Create new or import existing
          </span>
        </span>
      </button>
    </div>
  );
}
