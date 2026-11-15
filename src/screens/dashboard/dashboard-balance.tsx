import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import { formatQu } from "@/lib/format";
import type { OwnedAssetItem } from "@/hooks/use-owned-assets";

// ── Animated balance ─────────────────────────────────────────────────────────

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

// ── Balance display ──────────────────────────────────────────────────────────

export function BalanceDisplay({ balance, loading, hidden, fiatValue, priceChange24h }: {
  balance: bigint | undefined;
  loading: boolean;
  hidden: boolean;
  fiatValue?: string;
  priceChange24h: number | null;
}) {
  return (
    <>
      {hidden ? (
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-disabled)", letterSpacing: "-0.02em" }}>
          ••••••
        </span>
      ) : (
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.02em" }}>
          {loading ? <div className="skeleton" style={{ width: 200, height: 48 }} /> : balance !== undefined ? <AnimatedBalance value={balance} /> : "—"}
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
    </>
  );
}

// ── Owned asset chips ────────────────────────────────────────────────────────

export function OwnedAssetChips({ assets, hidden }: { assets: OwnedAssetItem[]; hidden: boolean }) {
  if (assets.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
      {assets.map((asset) => {
        const amount = Number(asset.numberOfUnits);
        const decimals = asset.numberOfDecimalPlaces;
        const displayAmount = decimals > 0
          ? (amount / Math.pow(10, decimals)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
          : amount.toLocaleString();
        return (
          <span
            key={`${asset.issuanceIndex}-${asset.managingContractIndex}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
              padding: "var(--space-1) var(--space-3)",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.04em",
            }}
          >
            {hidden ? "•••" : displayAmount} {asset.name}
          </span>
        );
      })}
    </div>
  );
}
