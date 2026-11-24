import { AsciiReveal, AsciiSkeleton } from "ascii-reveal";
import { Divider } from "@/components/divider";
import { Identicon } from "@/components/identicon";
import { formatQu, truncateId } from "@/lib/format";
import type { AccountMeta } from "@/store/persisted";

export interface PortfolioAccount {
  account: AccountMeta;
  identity: string | null;
  balance: bigint | null;
}

const DISTRIBUTION_COLORS = ["var(--color-accent)", "var(--color-status-success)", "var(--color-status-warning)", "var(--color-status-error)", "var(--color-text-secondary)", "var(--color-text-disabled)"];

export function DistributionBar({ accounts, total }: {
  accounts: { account: { index: number; name: string }; balance: bigint | null }[];
  total: bigint;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ height: 8, display: "flex", overflow: "hidden", borderRadius: 0, background: "var(--color-border-strong)" }}>
        {accounts.map(({ account, balance }, i) => {
          const pct = balance !== null && total > 0n ? Number((balance * 1000n) / total) / 10 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={account.index}
              title={`${account.name}: ${pct}%`}
              style={{ width: `${pct}%`, height: "100%", background: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2) var(--space-4)" }}>
        {accounts.map(({ account, balance }, i) => {
          const pct = balance !== null && total > 0n ? Math.round(Number((balance * 1000n) / total) / 10) : 0;
          if (pct === 0) return null;
          return (
            <div key={account.index} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
                {account.name} {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PortfolioAccountRowProps {
  entry: PortfolioAccount;
  position: number;
  total: bigint;
  allLoaded: boolean;
  hideBalances: boolean;
}

/** One account line in the portfolio list, including its share of the wallet total. */
export function PortfolioAccountRow({ entry, position, total, allLoaded, hideBalances }: PortfolioAccountRowProps) {
  const { account, identity, balance } = entry;
  const pct = total > 0n && balance !== null
    ? Math.round(Number((balance * 1000n) / total) / 10)
    : 0;

  return (
    <div className="stagger-item">
      {position > 0 && <Divider style={{ marginBottom: "var(--space-4)" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
        {identity && <Identicon kind="account" code={`A${account.index + 1}`} seed={identity} label={account.name} size={36} radius={8} style={{ flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
              {account.name}
            </span>
            <AsciiReveal
              loading={!allLoaded}
              revealOnMount={false}
              shimmer={false}
              duration="fast"
              style={{ flexShrink: 0 }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.04em" }}>
                {!allLoaded ? (
                  <AsciiSkeleton as="span" variant="scan" lines={1} widths={[80]} animate={false} />
                ) : hideBalances ? "••••••" : balance !== null ? `${formatQu(balance)} QU` : "—"}
              </span>
            </AsciiReveal>
          </div>
          {identity && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              {truncateId(identity)}
            </span>
          )}
          {allLoaded && !hideBalances && total > 0n && balance !== null && (
            <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <div style={{ flex: 1, height: 3, background: "var(--color-border-strong)", overflow: "hidden", borderRadius: 0 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--color-accent)" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.04em", width: 32, textAlign: "right", flexShrink: 0 }}>
                {pct}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
