import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { BalanceDisplay } from "@/components/balance-display";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { FramedAvatar } from "@/components/framed-avatar";
import { ScreenHeader } from "@/components/screen-header";
import { TextButton } from "@/components/text-button";
import { useMsvaultDetail, useMsvaultFees } from "@/hooks/use-msvault";
import { useLatestStats } from "@/hooks/use-latest-stats";
import { usePreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { MsvaultInactiveError } from "@/lib/api/msvault";
import { extractMessage, formatPreferredCurrencyFromQu, truncateId } from "@/lib/format";
import { MSVAULT_REVOKE_FEE, ownerIndex, vaultHoldingCoverage } from "@/lib/msvault";
import { hasPendingFromAccount } from "@/screens/send/send-flow";
import { ArrowUpRight01Icon, Download01Icon } from "@/lib/icons";
import {
  AssetMetaLabel,
  IdentityName,
  PendingApprovalsNotch,
  MultisigFlowShell,
  VaultId,
} from "./multisig-ui";

const SECTION_LABEL: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-tertiary)",
};

const BODY_COPY: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--leading-body)",
  color: "var(--color-text-secondary)",
  overflowWrap: "anywhere",
};

const MONO_META: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  color: "var(--color-text-tertiary)",
  overflowWrap: "anywhere",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} aria-label={title}>
      <h2 style={SECTION_LABEL}>{title}</h2>
      {children}
    </section>
  );
}

function InlineNotice({ tone, children }: { tone: "warning" | "info"; children: ReactNode }) {
  return (
    <div
      role="status"
      style={{
        padding: "var(--space-2) var(--space-3)",
        border: `1px solid ${tone === "warning" ? "var(--color-status-warning)" : "var(--color-border-default)"}`,
        borderRadius: "var(--radius-sharp)",
        background: tone === "warning" ? "var(--color-status-warning-soft)" : "var(--color-bg-subtle)",
      }}
    >
      <p
        style={{
          ...BODY_COPY,
          color: tone === "warning" ? "var(--color-status-warning)" : "var(--color-text-secondary)",
        }}
      >
        {children}
      </p>
    </div>
  );
}

export default function MultisigDetailScreen() {
  const navigate = useNavigate();
  const params = useParams();

  const settings = usePersistedStore((s) => s.settings);
  const wallets = usePersistedStore((s) => s.wallets);
  const contacts = usePersistedStore((s) => s.contacts);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const sessionAccounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const identity = getWalletAccountIdentity(wallet, settings.activeAccountIndex, sessionAccounts) ?? "";
  const { data: stats } = useLatestStats();
  const quote = usePreferredCurrencyQuote();

  const rawId = params.id ?? "";
  const vaultId = useMemo(() => {
    if (!/^\d+$/.test(rawId)) return null;
    try {
      return BigInt(rawId);
    } catch {
      return null;
    }
  }, [rawId]);

  const detailQuery = useMsvaultDetail(vaultId);
  const feesQuery = useMsvaultFees();
  const detail = detailQuery.data ?? null;
  const fees = feesQuery.data ?? null;

  const header = useMemo(
    () => (
      <ScreenHeader
        title={!vaultId ? "Vault not found" : detail?.name.trim() || "Multisig vault"}
        onBack={() => navigate("/multisig")}
      />
    ),
    [detail, navigate, vaultId],
  );

  const hasPending = hasPendingFromAccount(pendingTxs, identity);
  const activeOwner = detail ? ownerIndex(detail.owners, identity) : -1;
  const isOwner = activeOwner >= 0;

  if (!vaultId) {
    return (
      <AppShell statusBar={header}>
        <EmptyCollectionState
          title="Vault not found"
          description="This multisig vault could not be found."
          icon="search"
        />
      </AppShell>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <AppShell statusBar={header}>
        <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              style={{
                height: 68,
                borderRadius: "var(--radius-sharp)",
                background: "var(--color-skeleton)",
              }}
            />
          ))}
        </div>
      </AppShell>
    );
  }

  if (detailQuery.error instanceof MsvaultInactiveError) {
    return (
      <AppShell statusBar={header}>
        <EmptyCollectionState
          title="This vault is inactive"
          description="Unpaid holding fees can close a vault. It can no longer accept deposits or releases."
          icon="activity"
        />
      </AppShell>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <AppShell statusBar={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>
            {extractMessage(detailQuery.error, "Could not load vault")}
          </p>
          <Button size="sm" variant="secondary" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </div>
      </AppShell>
    );
  }

  const coverage = fees ? vaultHoldingCoverage(detail.balance, fees.holdingFee) : null;
  const actionsDisabled = hasPending;
  const pendingApprovals = detail.proposals.length;
  const fiatValue = stats?.price
    ? formatPreferredCurrencyFromQu(detail.balance, { usdPrice: stats.price, ...quote }).text
    : undefined;

  const vaultFooter = (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <Button
        size="md"
        style={{ width: "auto", flex: "1 1 140px" }}
        disabled={actionsDisabled}
        onClick={() => navigate(`/multisig/${rawId}/deposit`)}
      >
        <Download01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        Deposit
      </Button>
      <Button
        size="md"
        variant="secondary"
        style={{ width: "auto", flex: "1 1 140px" }}
        disabled={!isOwner || actionsDisabled}
        onClick={() => navigate(`/multisig/${rawId}/release`)}
        title={!isOwner ? "Only owners can request releases." : undefined}
      >
        <ArrowUpRight01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        Request release
      </Button>
    </div>
  );

  return (
    <MultisigFlowShell
      statusBar={header}
      footer={vaultFooter}
      notch={pendingApprovals > 0 ? (
        <PendingApprovalsNotch
          count={pendingApprovals}
          onClick={() => navigate(`/multisig/${rawId}/approvals`)}
        />
      ) : undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {!isOwner ? (
        <InlineNotice tone="info">
          You are not an owner. You can deposit, but only owners can approve releases.
        </InlineNotice>
      ) : null}

      <section
        aria-label="Vault balance"
        style={{
          marginInline: "calc(-1 * var(--screen-padding))",
          borderBottom: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-base)",
        }}
      >
        <AsciiBackdrop
          style={{ minHeight: 220 }}
          contentStyle={{
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-5) var(--screen-padding)",
          }}
        >
          <div className="asciify-clear">
            <span style={SECTION_LABEL}>Vault balance</span>
          </div>
          <div className="asciify-clear">
            <BalanceDisplay
              balance={detail.balance}
              loading={false}
              hidden={settings.hideBalances}
              fiatValue={fiatValue}
              priceChange24h={null}
            />
          </div>
          {detail.assets.length > 0 ? (
            <div className="asciify-clear" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-1)", maxWidth: "100%" }}>
              {detail.assets.map((balance) => (
                <span
                  key={`${balance.asset.issuer}:${balance.asset.assetName.toString()}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    padding: "var(--space-1) var(--space-3)",
                    background: "var(--color-bg-surface)",
                    borderRadius: "var(--radius-pill)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-mono-sm)",
                    color: "var(--color-text-secondary)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {settings.hideBalances ? (
                    <>••• {balance.asset.name || "Asset"}</>
                  ) : (
                    <AssetMetaLabel asset={balance.asset} amount={balance.amount} />
                  )}
                </span>
              ))}
            </div>
          ) : null}
          <div className="asciify-clear" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <span style={MONO_META}>{detail.requiredApprovals} of {detail.owners.length} approvals</span>
            <VaultId id={detail.id} />
          </div>
          <div className="asciify-clear">
            {feesQuery.isLoading ? (
              <span style={MONO_META}>Loading fees…</span>
            ) : feesQuery.isError || !fees ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>Fees unavailable</span>
                <TextButton onClick={() => void feesQuery.refetch()}>Retry</TextButton>
              </div>
            ) : (
              <span style={MONO_META}>
                {coverage !== null
                  ? coverage > 0n
                    ? `Holding fee covered for ${coverage.toString()} epochs`
                    : "Below holding fee"
                  : "No holding fee"}
              </span>
            )}
          </div>
        </AsciiBackdrop>
      </section>

      {detail.assets.length > 0 && detail.balance < MSVAULT_REVOKE_FEE ? (
        <InlineNotice tone="warning">Asset releases need at least 100 QU in the vault.</InlineNotice>
      ) : null}

      <Section title="Owners">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minWidth: 0 }}>
          {detail.owners.map((owner) => (
            <div
              key={owner}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}
            >
              <FramedAvatar seed={owner} size={30} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
                  <IdentityName identity={owner} contacts={contacts} wallet={wallet} sessionAccounts={sessionAccounts} />
                </span>
                <span style={MONO_META} title={owner}>{truncateId(owner, 10, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      </div>
    </MultisigFlowShell>
  );
}
