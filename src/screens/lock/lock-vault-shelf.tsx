import { AddCircleIcon } from "@/lib/icons";
import { Identicon } from "@/components/identicon";
import { timeAgo } from "@/lib/format";
import type { usePersistedStore } from "@/store/persisted";

type Vault = NonNullable<ReturnType<typeof usePersistedStore.getState>["vaults"][number]>;

function VaultShelfRow({
  vault,
  selected,
  onSelect,
  isLast,
}: {
  vault: Vault;
  selected: boolean;
  onSelect: () => void;
  isLast: boolean;
}) {
  const lastOpened = vault.lastUnlockedAt ? `Last opened ${timeAgo(vault.lastUnlockedAt)}` : "Not opened yet";

  return (
    <button
      type="button"
      className="vault-shelf-row"
      data-selected={selected ? "true" : "false"}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${vault.name}. ${lastOpened}`}
      style={{
        width: "100%",
        minHeight: 64,
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
      <Identicon kind="vault" seed={`${vault.id}:${vault.color}`} label={vault.name} size={36} radius={9} padding={2} walletIcon={vault.icon} vaultColor={vault.color} />
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
          {vault.name}
        </span>
        <span style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
          {lastOpened}
        </span>
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--radius-pill)",
          border: `1px solid ${selected ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
        }}
      >
        {selected ? (
          <span style={{ width: 8, height: 8, borderRadius: "var(--radius-pill)", background: "var(--color-text-primary)" }} />
        ) : null}
      </span>
    </button>
  );
}

export function LockVaultShelf({
  vaults,
  selectedId,
  onSelect,
  onAdd,
}: {
  vaults: Vault[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div
        role="group"
        aria-label="Choose a Vault to unlock"
        style={{
          maxHeight: vaults.length > 3 ? 194 : undefined,
          overflowY: vaults.length > 3 ? "auto" : "hidden",
          border: "1px solid var(--color-border-default)",
          borderRadius: "var(--radius-card)",
          background: "var(--color-bg-surface-2)",
        }}
      >
        {vaults.map((vault, index) => (
          <VaultShelfRow
            key={vault.id}
            vault={vault}
            selected={vault.id === selectedId}
            isLast={index === vaults.length - 1}
            onSelect={() => onSelect(vault.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="vault-shelf-add"
        onClick={onAdd}
        aria-label="Add another Vault"
      >
        <span className="vault-shelf-add-icon" aria-hidden="true">
          <AddCircleIcon size={17} strokeWidth={1.5} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <span style={{ fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
            Add another Vault
          </span>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            Create new or import existing
          </span>
        </span>
      </button>
    </div>
  );
}
