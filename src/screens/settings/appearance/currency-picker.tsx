import type { AppSettings } from "@/store/persisted";

const CURRENCIES: { id: AppSettings["currency"]; label: string }[] = [
  { id: "USD", label: "USD" },
  { id: "EUR", label: "EUR" },
  { id: "BTC", label: "BTC" },
];

export function CurrencyPicker({
  value,
  onChange,
}: {
  value: AppSettings["currency"];
  onChange: (currency: AppSettings["currency"]) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Currency" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)" }}>
      {CURRENCIES.map(({ id, label }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            className="settings-pressable"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            style={{
              minHeight: 44,
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "var(--radius-control)",
              background: selected ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
              color: selected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label)",
              fontWeight: selected ? 600 : 400,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
