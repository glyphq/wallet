import { CheckmarkCircle01Icon, Settings01Icon } from "@/lib/icons";
import { Identicon } from "@/components/identicon";
import { timeAgo } from "@/lib/format";
import type { VaultMeta } from "@/store/persisted";

interface VaultListProps {
  vaults: VaultMeta[];
  activeVaultId: string | null;
  switchLoading: boolean;
  switchingVaultId: string | null;
  recentlySwitchedId: string | null;
  onSelect: (vault: VaultMeta) => void;
  onOpenActions: (vault: VaultMeta) => void;
}

/** Vault rows sorted by most recently unlocked, plus the empty state. */
export function VaultList({
  vaults,
  activeVaultId,
  switchLoading,
  switchingVaultId,
  recentlySwitchedId,
  onSelect,
  onOpenActions,
}: VaultListProps) {
  const sorted = vaults.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));

  return (
    <>
      {sorted.map((vault) => {
        const isActive = vault.id === activeVaultId;
        const visibleCount = vault.accounts.filter((a) => !a.hidden).length;
        const isSwitching = switchLoading && switchingVaultId === vault.id;

        return (
          <div
            key={vault.id}
            className={`stagger-item${recentlySwitchedId === vault.id ? " flash-success" : ""}`}
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
              onClick={() => onSelect(vault)}
              disabled={switchLoading}
              aria-busy={isSwitching || undefined}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                background: "none", border: "none", cursor: switchLoading ? "not-allowed" : "pointer",
                flex: 1, minWidth: 0, textAlign: "left", padding: 0,
              }}
            >
              <Identicon kind="vault" seed={`${vault.id}:${vault.color}`} label={vault.name} size={36} radius={10} style={{ flexShrink: 0 }} walletIcon={vault.icon} vaultColor={vault.color} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                    fontWeight: 600, color: "var(--color-text-display)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {vault.name}
                  </span>
                </div>
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                  color: "var(--color-text-disabled)",
                }}>
                  {isSwitching
                    ? <span role="status" aria-live="polite">Unlocking vault…</span>
                    : `${visibleCount} ${visibleCount === 1 ? "account" : "accounts"} · Unlocked ${timeAgo(vault.lastUnlockedAt).toLowerCase()}`}
                </span>
              </div>
              {isActive && (
                <span aria-label="Selected vault" title="Selected vault" style={{ display: "inline-flex", color: "var(--color-accent)", flexShrink: 0 }}>
                  <CheckmarkCircle01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label="Vault options"
              onClick={() => onOpenActions(vault)}
              disabled={switchLoading}
              style={{
                background: "none", border: "none", cursor: switchLoading ? "not-allowed" : "pointer",
                color: "var(--color-text-disabled)", padding: "var(--space-2)",
                flexShrink: 0, display: "flex", alignItems: "center",
              }}
            >
              <Settings01Icon size={16} strokeWidth={1.5} />
            </button>
          </div>
        );
      })}

      {vaults.length === 0 && (
        <div style={{
          textAlign: "center", padding: "var(--space-12) 0",
          fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
          color: "var(--color-text-disabled)",
        }}>
          No vaults yet
        </div>
      )}
    </>
  );
}
