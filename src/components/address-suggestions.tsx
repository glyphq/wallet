import { Identicon } from "@/components/identicon";
import type { AddressSuggestion } from "@/lib/address-intelligence";

const KIND_LABEL: Record<AddressSuggestion["kind"], string> = {
  contact: "Contact",
  account: "Account",
  contract: "Contract",
  recent: "Recent",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 2, animation: "slide-down 0.15s ease-out" }}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.identity}
          type="button"
          onClick={() => onSelect(suggestion.identity)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "10px 12px",
            textAlign: "left",
            borderRadius: 10,
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Identicon seed={suggestion.identity} size={24} radius={6} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {suggestion.label}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-text-disabled)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {suggestion.secondary}
            </span>
          </div>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.625rem", fontWeight: 500, color: "var(--color-text-disabled)", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {KIND_LABEL[suggestion.kind]}
          </span>
        </button>
      ))}
    </div>
  );
}
