import { Button } from "@/components/button";
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
          <Button
            key={id}
            role="radio"
            aria-checked={selected}
            variant={selected ? "primary" : "secondary"}
            size="sm"
            style={{ width: "100%" }}
            onClick={() => onChange(id)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
