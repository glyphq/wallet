import { Fragment } from "react";
import { MAX_WALLET_ACCOUNTS } from "@/hooks/use-wallet-balances";
import type { AccountMeta } from "@/store/persisted";

/** Scrollable account checklist shown when an export holds more accounts than a Wallet can take. */
export function ImportAccountList({
  accounts,
  selectedIndices,
  onToggle,
}: {
  accounts: AccountMeta[];
  selectedIndices: Set<number>;
  onToggle: (index: number) => void;
}) {
  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-4)",
        maxHeight: 220,
        overflowY: "auto",
      }}
    >
      {[...accounts].sort((a, b) => a.index - b.index).map((account, index, sorted) => {
        const selected = selectedIndices.has(account.index);
        const atLimit = !selected && selectedIndices.size >= MAX_WALLET_ACCOUNTS;
        return (
          <Fragment key={account.index}>
            <button
              type="button"
              onClick={() => onToggle(account.index)}
              disabled={atLimit}
              aria-pressed={selected}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-3) 0",
                background: "transparent",
                border: "none",
                cursor: atLimit ? "not-allowed" : "pointer",
                opacity: atLimit ? 0.45 : 1,
                textAlign: "left",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  border: `1px solid ${selected ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
                  color: selected ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-mono-sm)",
                  flexShrink: 0,
                }}
              >
                {selected ? "✓" : ""}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-body)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {account.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-mono-sm)",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  #{account.index + 1}
                </span>
              </div>
            </button>
            {index < sorted.length - 1 ? <div style={{ height: 1, background: "var(--color-border-subtle)" }} /> : null}
          </Fragment>
        );
      })}
    </div>
  );
}
