import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { Divider } from "@/components/divider";
import { Identicon } from "@/components/identicon";
import { Tag } from "@/components/tag";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useVaultBalances } from "@/hooks/use-vault-balances";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { truncateId, formatQu, formatUsdFromQu } from "@/lib/format";
import { getVaultAccountIdentity } from "@/lib/accounts";

export default function PortfolioScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === id));
  const hideBalances = usePersistedStore((s) => s.settings.hideBalances);
  const wallets = useSessionStore((s) => s.wallets);
  const { data: balances, isLoading } = useVaultBalances();
  const { data: stats } = useLatestStats();

  if (!vault) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.08em" }}>
          [vault not found]
        </div>
      </AppShell>
    );
  }

  const visibleAccounts = vault.accounts.filter((a) => !a.hidden);

  const accountsWithBalance = visibleAccounts.map((account) => {
    const identity = getVaultAccountIdentity(vault, account.index, wallets);
    const balance = identity ? (balances?.[identity] ?? null) : null;
    return { account, identity, balance };
  });

  const totalBalance = accountsWithBalance.reduce(
    (sum, { balance }) => sum + (balance ?? 0n),
    0n,
  );

  const allLoaded = !isLoading && balances !== undefined;

  return (
    <AppShell contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <Identicon kind="vault" seed={`${vault.id}:${vault.color}`} label={vault.name} size={36} radius={10} style={{ flexShrink: 0 }} walletIcon={vault.icon} vaultColor={vault.color} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {vault.name}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/vaults/${id}`)}
            style={{
              alignSelf: "flex-start",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-label)",
              color: "var(--color-text-secondary)",
            }}
          >
            View vault details
          </button>
        </div>
      </div>

      {/* ── Total balance ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          Total balance
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "var(--text-display)", letterSpacing: "-0.02em", color: "var(--color-text-display)" }}>
            {!allLoaded ? <div className="skeleton" style={{ width: 200, height: 48 }} /> : hideBalances ? "••••••" : formatQu(totalBalance)}
          </span>
          {allLoaded && !hideBalances && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-disabled)" }}>QU</span>
          )}
        </div>
        {allLoaded && !hideBalances && stats?.price && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
            ≈ ${formatUsdFromQu(totalBalance, stats.price)} USD
          </span>
        )}
        {vault.kind === "watch_only" && (
          <Tag variant="neutral" style={{ alignSelf: "flex-start", marginTop: "var(--space-1)" }}>Watch only</Tag>
        )}
      </div>

      {/* ── Distribution bar ── */}
      {allLoaded && totalBalance > 0n && !hideBalances && (
        <DistributionBar accounts={accountsWithBalance} total={totalBalance} />
      )}

      <Divider />

      {/* ── Account list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          Accounts ({visibleAccounts.length})
        </span>

        {accountsWithBalance.map(({ account, identity, balance }, i) => {
          const pct = totalBalance > 0n && balance !== null
            ? Math.round(Number((balance * 1000n) / totalBalance) / 10)
            : 0;
          return (
            <div key={account.index} className="stagger-item">
              {i > 0 && <Divider style={{ marginBottom: "var(--space-4)" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                {identity && <Identicon kind="account" code={`A${account.index + 1}`} seed={identity} label={account.name} size={36} radius={8} style={{ flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
                      {account.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.04em", flexShrink: 0 }}>
                      {!allLoaded ? <div className="skeleton" style={{ width: 80, height: 12 }} /> : hideBalances ? "••••••" : balance !== null ? `${formatQu(balance)} QU` : "—"}
                    </span>
                  </div>
                  {identity && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                      {truncateId(identity)}
                    </span>
                  )}
                  {allLoaded && !hideBalances && totalBalance > 0n && balance !== null && (
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
        })}
      </div>
    </AppShell>
  );
}

function DistributionBar({ accounts, total }: {
  accounts: { account: { index: number; name: string }; balance: bigint | null }[];
  total: bigint;
}) {
  const COLORS = ["var(--color-accent)", "var(--color-status-success)", "var(--color-status-warning)", "var(--color-status-error)", "var(--color-text-secondary)", "var(--color-text-disabled)"];
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
              style={{ width: `${pct}%`, height: "100%", background: COLORS[i % COLORS.length] }}
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
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
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
