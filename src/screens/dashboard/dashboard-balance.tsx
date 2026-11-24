import type { OwnedAssetItem } from "@/hooks/use-owned-assets";

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
