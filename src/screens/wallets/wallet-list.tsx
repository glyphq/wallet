import { CheckmarkCircle01Icon, Settings01Icon } from "@/lib/icons";
import { Identicon } from "@/components/identicon";
import { timeAgo } from "@/lib/format";
import type { WalletMeta } from "@/store/persisted";

interface WalletListProps {
  wallets: WalletMeta[];
  activeWalletId: string | null;
  onSelect: (wallet: WalletMeta) => void;
  onOpenActions: (wallet: WalletMeta) => void;
}

/** Wallet rows sorted by most recently unlocked, plus the empty state. */
export function WalletList({
  wallets,
  activeWalletId,
  onSelect,
  onOpenActions,
}: WalletListProps) {
  const sorted = wallets.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));

  return (
    <>
      {sorted.map((wallet) => {
        const isActive = wallet.id === activeWalletId;
        const visibleCount = wallet.accounts.length;

        return (
          <div
            key={wallet.id}
            className="stagger-item"
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              padding: "var(--space-3) var(--space-4)",
              background: isActive ? "var(--color-bg-elevated)" : "transparent",
              borderRadius: "var(--radius-card)",
              border: `1px solid ${isActive ? "var(--color-border-strong)" : "transparent"}`,
              boxShadow: "none",
              transition: "background 0.12s, border-color 0.12s, box-shadow 0.12s",
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(wallet)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                background: "none", border: "none", cursor: "pointer",
                flex: 1, minWidth: 0, textAlign: "left", padding: 0,
              }}
            >
              <Identicon kind="wallet" seed={`${wallet.id}:${wallet.color}`} label={wallet.name} size={36} style={{ flexShrink: 0 }} walletIcon={wallet.icon} walletColor={wallet.color} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                    fontWeight: 600, color: "var(--color-text-display)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {wallet.name}
                  </span>
                </div>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                  color: "var(--color-text-disabled)",
                }}>
                  {`${visibleCount} ${visibleCount === 1 ? "account" : "accounts"} · Unlocked ${timeAgo(wallet.lastUnlockedAt).toLowerCase()}`}
                </span>
              </div>
              {isActive && (
                <span aria-label="Selected wallet" title="Selected wallet" style={{ display: "inline-flex", color: "var(--color-accent)", flexShrink: 0 }}>
                  <CheckmarkCircle01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label="Wallet options"
              onClick={() => onOpenActions(wallet)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--color-text-disabled)", padding: "var(--space-2)",
                flexShrink: 0, display: "flex", alignItems: "center",
              }}
            >
              <Settings01Icon size={16} strokeWidth={1.5} />
            </button>
          </div>
        );
      })}

      {wallets.length === 0 && (
        <div style={{
          textAlign: "center", padding: "var(--space-12) 0",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
          color: "var(--color-text-disabled)",
        }}>
          No wallets yet
        </div>
      )}
    </>
  );
}
