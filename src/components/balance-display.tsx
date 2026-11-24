import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import { AsciiReveal, AsciiSkeleton } from "ascii-reveal";
import { formatQu } from "@/lib/format";

function AnimatedBalance({ value }: { value: bigint }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<bigint | null>(null);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  const num = Number(value);

  useEffect(() => {
    if (prevRef.current === null) {
      prevRef.current = value;
      if (spanRef.current) spanRef.current.textContent = formatQu(value);
      return;
    }
    const from = prevRef.current;
    prevRef.current = value;
    if (from > maxSafe || value > maxSafe) {
      if (spanRef.current) spanRef.current.textContent = formatQu(value);
      return;
    }
    const controls = animate(Number(from), num, {
      duration: 0.5,
      ease: "easeOut",
      onUpdate: (v) => {
        if (spanRef.current) spanRef.current.textContent = formatQu(v);
      },
      onComplete: () => {
        if (spanRef.current) spanRef.current.textContent = formatQu(value);
      },
    });
    return () => controls.stop();
  }, [num, value, maxSafe]);

  return (
    <span ref={spanRef} aria-live="polite" aria-atomic="true" style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatQu(value)}
    </span>
  );
}

/** Large animated QUBIC balance used by the dashboard and vault hero. */
export function BalanceDisplay({ balance, loading, hidden, fiatValue, priceChange24h }: {
  balance: bigint | undefined;
  loading: boolean;
  hidden: boolean;
  fiatValue?: string;
  priceChange24h: number | null;
}) {
  return (
    <AsciiReveal
      loading={loading}
      revealOnMount={false}
      shimmer={false}
      duration="fast"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)" }}
    >
      {hidden ? (
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-disabled)", letterSpacing: "-0.02em" }}>
          ••••••
        </span>
      ) : (
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.02em" }}>
          {loading ? (
            <AsciiSkeleton as="div" variant="scan" rows={4} width={200} height={48} animate={false} />
          ) : balance !== undefined ? (
            <AnimatedBalance value={balance} />
          ) : (
            "—"
          )}
        </span>
      )}

      {balance !== undefined && !loading && !hidden && fiatValue !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            {fiatValue}
          </span>
          {priceChange24h !== null && (
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 500,
              color: priceChange24h >= 0 ? "var(--color-status-success)" : "var(--color-status-error)",
              padding: "1px var(--space-2)", borderRadius: "var(--radius-pill)",
              background: priceChange24h >= 0 ? "var(--color-status-success-soft)" : "var(--color-status-error-soft)",
            }}>
              {priceChange24h >= 0 ? "+" : ""}{priceChange24h.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </AsciiReveal>
  );
}
