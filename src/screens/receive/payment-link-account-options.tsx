import { CheckmarkCircle01Icon } from "@/lib/icons";
import { truncateId } from "@/lib/format";
import { eyebrowStyle, sectionStyle } from "./payment-link-utils";

export function PaymentLinkAccountOptions({
  accounts,
  selectedIdentity,
  onSelect,
}: {
  accounts: Array<{ name: string; identity: string }>;
  selectedIdentity: string;
  onSelect: (identity: string) => void;
}) {
  if (accounts.length <= 1) return null;

  return (
    <section aria-labelledby="receive-to-heading" style={sectionStyle}>
      <span id="receive-to-heading" style={eyebrowStyle}>Receive to</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, borderBottom: "1px solid var(--color-border-subtle)" }}>
        {accounts.map((a) => {
          const selected = selectedIdentity === a.identity;
          return (
            <button
              key={a.identity}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(a.identity)}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "var(--space-3)",
                alignItems: "center",
                minHeight: 44,
                width: "100%",
                padding: "var(--space-3) 0",
                background: "transparent",
                border: 0,
                borderTop: "1px solid var(--color-border-subtle)",
                color: "var(--color-text-primary)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
                <span style={{ fontSize: "var(--text-body)", fontWeight: 500 }}>{a.name}</span>
                <span style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)" }}>
                  {truncateId(a.identity, 8, 6)}
                </span>
              </span>
              {selected ? (
                <CheckmarkCircle01Icon size={18} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
              ) : (
                <span style={{ color: "var(--color-text-disabled)", fontSize: "var(--text-label)", fontWeight: 600 }}>Use</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
