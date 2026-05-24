import { Identicon } from "@/components/identicon";
import type { AddressSuggestion } from "@/lib/address-intelligence";

const KIND_LABEL: Record<AddressSuggestion["kind"], string> = {
  contact: "CONTACT",
  account: "ACCOUNT",
  contract: "CONTRACT",
  recent: "RECENT",
};

export function AddressSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: AddressSuggestion[];
  onSelect: (identity: string) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.identity}
          type="button"
          onClick={() => onSelect(suggestion.identity)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-sharp)",
            cursor: "pointer",
            padding: "var(--space-3)",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
            <Identicon seed={suggestion.identity} size={28} radius={4} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                {suggestion.label}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
                {suggestion.secondary}
              </div>
            </div>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", flexShrink: 0 }}>
            {KIND_LABEL[suggestion.kind]}
          </span>
        </button>
      ))}
    </div>
  );
}
