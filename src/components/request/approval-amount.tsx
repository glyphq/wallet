import { formatPreferredCurrencyFromQu, formatQu } from "@/lib/format";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";

/** Amount summary shared by request previews, with the configured fiat equivalent. */
export function ApprovalAmount({ amount }: { amount: bigint | string | null }) {
  const { data: stats } = useLatestStats();
  const quote = usePreferredCurrencyQuote();
  const amountText = amount === null ? "—" : formatQu(amount);
  const amountFontSize = Math.max(16, Math.min(42, Math.floor(270 / Math.max(1, amountText.length * 0.62))));
  const fiat = amount !== null
    ? formatPreferredCurrencyFromQu(amount, { usdPrice: stats?.price ?? null, ...quote })
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
        Amount
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span
          title={amountText}
          style={{ fontFamily: "var(--font-sans)", fontWeight: 300, fontSize: amountFontSize, lineHeight: 1, color: "var(--color-text-display)", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}
        >
          {amountText}
        </span>
        <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.1em", color: "var(--color-text-tertiary)" }}>QUBIC</span>
      </div>
      {fiat?.available ? (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.04em", color: "var(--color-text-tertiary)" }}>
          {fiat.text}
        </span>
      ) : null}
    </div>
  );
}
