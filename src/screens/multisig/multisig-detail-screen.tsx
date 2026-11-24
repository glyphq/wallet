import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { FramedAvatar } from "@/components/framed-avatar";
import { ScreenHeader } from "@/components/screen-header";
import { Tag } from "@/components/tag";
import { TextButton } from "@/components/text-button";
import { useMsvaultDetail, useMsvaultFees } from "@/hooks/use-msvault";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { useTickInfo } from "@/hooks/use-tick-info";
import { usePersistedStore, type Contact, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import type { SessionAccount } from "@/lib/session-account";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { estimateTargetTick } from "@/lib/api/network";
import { MsvaultInactiveError } from "@/lib/api/msvault";
import { broadcastTx } from "@/lib/broadcast";
import {
  MSVAULT,
  MSVAULT_ADDRESS,
  MSVAULT_RESET_ASSET_RELEASE_INPUT_TYPE,
  MSVAULT_RESET_RELEASE_INPUT_TYPE,
} from "@/lib/contracts";
import { extractMessage, formatQu, truncateId } from "@/lib/format";
import {
  MSVAULT_REVOKE_FEE,
  ownerIndex,
  vaultHoldingCoverage,
  type MsvaultDetail,
  type MsvaultProposal,
} from "@/lib/msvault";
import { qk } from "@/lib/query-keys";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { hasPendingFromAccount } from "@/screens/send/send-flow";
import {
  AssetMetaLabel,
  FeeRow,
  HoldingFeeWarning,
  IdentityName,
  MultisigAccountSelect,
  MultisigConfirmSheet,
  VaultId,
  identityDisplayName,
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

const CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: "var(--space-4)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-sharp)",
  background: "var(--color-bg-surface)",
};

const INLINE_ROW: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  minWidth: 0,
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

function ProposalCard({
  proposal,
  detail,
  activeOwner,
  contacts,
  wallet,
  sessionAccounts,
  hasPending,
  feesReady,
  feesFailed,
  onApprove,
  onWithdraw,
}: {
  proposal: MsvaultProposal;
  detail: MsvaultDetail;
  activeOwner: number;
  contacts: Contact[];
  wallet: WalletMeta | null;
  sessionAccounts: SessionAccount[];
  hasPending: boolean;
  feesReady: boolean;
  feesFailed: boolean;
  onApprove: (proposal: MsvaultProposal) => void;
  onWithdraw: (proposal: MsvaultProposal) => void;
}) {
  const isOwner = activeOwner >= 0;
  const supportedByMe = isOwner && proposal.supporters.includes(activeOwner);
  const currentSameKind = detail.proposals.find(
    (candidate) => candidate.kind === proposal.kind && candidate.supporters.includes(activeOwner),
  );
  const replacesOther = !supportedByMe && !!currentSameKind && currentSameKind.key !== proposal.key;
  const remaining = Math.max(0, proposal.requiredApprovals - proposal.approvals);
  const ready = remaining === 0;
  const destinationName = identityDisplayName(
    proposal.destination,
    contacts,
    wallet,
    sessionAccounts,
  );

  return (
    <div className="corner-frame" style={CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span style={MONO_META}>{proposal.kind === "qubic" ? "QUBIC release" : "Asset release"}</span>
        <Tag variant={ready ? "success" : "warning"}>{ready ? "Ready" : `Needs ${remaining} more approvals`}</Tag>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap", minWidth: 0 }}>
        {proposal.kind === "asset" && proposal.asset ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
            <AssetMetaLabel asset={proposal.asset} amount={proposal.amount} />
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
            {formatQu(proposal.amount)} QU
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
        <span style={SECTION_LABEL}>To</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap", minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
            {destinationName}
          </span>
          <span style={{ ...MONO_META, color: "var(--color-text-disabled)" }} title={proposal.destination}>
            {truncateId(proposal.destination, 8, 8)}
          </span>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span style={MONO_META}>{proposal.approvals} of {proposal.requiredApprovals} approvals</span>
        <span aria-hidden="true" style={{ ...MONO_META, color: "var(--color-text-disabled)" }}>·</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}>
          {proposal.supporters.map((ownerIdx) => {
            const supporter = detail.owners[ownerIdx];
            if (!supporter) return null;
            return (
              <span key={`${proposal.key}:${ownerIdx}`} title={identityDisplayName(supporter, contacts, wallet, sessionAccounts)}>
                <FramedAvatar seed={supporter} size={22} />
              </span>
            );
          })}
        </span>
      </div>

      {isOwner ? (
        supportedByMe ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Tag variant="neutral">Your approval</Tag>
            </div>
            <TextButton
              tone="danger"
              disabled={hasPending || !feesReady}
              onClick={() => onWithdraw(proposal)}
              title={hasPending ? "Wait for your pending transaction to confirm." : undefined}
            >
              Withdraw approval
            </TextButton>
            {hasPending ? <p style={BODY_COPY}>Wait for your pending transaction to confirm.</p> : null}
            {feesFailed ? <p style={BODY_COPY}>Fees unavailable. Try again once fees load.</p> : null}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Button
              size="sm"
              variant="secondary"
              style={{ width: "auto" }}
              disabled={hasPending}
              onClick={() => onApprove(proposal)}
              title={hasPending ? "Wait for your pending transaction to confirm." : undefined}
            >
              Approve
            </Button>
            {hasPending ? <p style={BODY_COPY}>Wait for your pending transaction to confirm.</p> : null}
            {replacesOther ? (
              <p style={BODY_COPY}>
                {proposal.kind === "qubic"
                  ? "Replaces your current QUBIC approval."
                  : "Replaces your current asset approval."}
              </p>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

export default function MultisigDetailScreen() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();

  const settings = usePersistedStore((s) => s.settings);
  const wallets = usePersistedStore((s) => s.wallets);
  const contacts = usePersistedStore((s) => s.contacts);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const sessionAccounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const identity = getWalletAccountIdentity(wallet, settings.activeAccountIndex, sessionAccounts) ?? "";
  const apiIdentity = useApiCacheIdentity();
  const { data: tickInfo } = useTickInfo();

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

  const [resetTarget, setResetTarget] = useState<MsvaultProposal | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState("");

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

  function approveHref(proposal: MsvaultProposal): string {
    const search = new URLSearchParams({
      kind: proposal.kind,
      amount: proposal.amount.toString(),
      to: proposal.destination,
    });
    if (proposal.kind === "asset" && proposal.asset) {
      search.set("asset", `${proposal.asset.issuer}:${proposal.asset.assetName.toString()}`);
    }
    return `/multisig/${rawId}/release?${search.toString()}`;
  }

  async function sendReset(proposal: MsvaultProposal) {
    if (!detail || !tickInfo || !identity) return;
    if (!fees) {
      setResetError("Fees unavailable. Try again once fees load.");
      return;
    }
    setResetSending(true);
    setResetError("");
    try {
      const isAsset = proposal.kind === "asset";
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload = MSVAULT.encodeProcedure(
        isAsset ? "resetAssetRelease" : "resetRelease",
        { vaultId: detail.id },
      );

      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: MSVAULT_ADDRESS,
        inputType: isAsset
          ? MSVAULT_RESET_ASSET_RELEASE_INPUT_TYPE
          : MSVAULT_RESET_RELEASE_INPUT_TYPE,
        payload,
        amount: fees.releaseResetFee,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: MSVAULT_ADDRESS,
        amount: fees.releaseResetFee.toString(),
        targetTick,
        // eslint-disable-next-line react/purity -- broadcast timestamp is only read in an event handler
        broadcastAt: Date.now(),
        contractName: isAsset ? "MSVault · Reset asset release" : "MSVault · Reset release",
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.msvaultVault(apiIdentity, detail.id.toString()) }),
        queryClient.invalidateQueries({ queryKey: qk.msvaultVaults(apiIdentity, identity) }),
      ]);
      setResetTarget(null);
    } catch (error) {
      setResetError(extractMessage(error, "Broadcast failed."));
    } finally {
      setResetSending(false);
    }
  }

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
            {extractMessage(detailQuery.error, "Could not load this vault.")}
          </p>
          <Button size="sm" variant="secondary" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </div>
      </AppShell>
    );
  }

  const coverage = fees ? vaultHoldingCoverage(detail.balance, fees.holdingFee) : null;
  const qubicProposals = detail.proposals.filter((proposal) => proposal.kind === "qubic");
  const assetProposals = detail.proposals.filter((proposal) => proposal.kind === "asset");
  const actionsDisabled = hasPending;

  return (
    <AppShell
      statusBar={header}
      contentStyle={{
        padding: "var(--space-4)",
        paddingBottom: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      <MultisigAccountSelect
        wallet={wallet}
        accounts={sessionAccounts}
        activeIndex={settings.activeAccountIndex}
        onSelect={setActiveAccountIndex}
      />

      {!isOwner ? (
        <InlineNotice tone="info">
          You are not an owner. You can deposit, but only owners can approve releases.
        </InlineNotice>
      ) : null}

      <section className="corner-frame" style={CARD} aria-label="Vault balance">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={SECTION_LABEL}>Vault balance</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 300,
                fontSize: "var(--text-headline)",
                lineHeight: 1,
                color: "var(--color-text-display)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatQu(detail.balance)}
            </span>
            <span style={MONO_META}>QU</span>
          </span>
        </div>

        <div style={INLINE_ROW}>
          <span style={MONO_META}>
            {detail.requiredApprovals} of {detail.owners.length} approvals
          </span>
          <VaultId id={detail.id} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {feesQuery.isLoading ? (
            <span style={MONO_META}>Loading fees…</span>
          ) : feesQuery.isError || !fees ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
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

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={SECTION_LABEL}>Assets</span>
          {detail.assets.length === 0 ? (
            <span style={BODY_COPY}>No assets</span>
          ) : (
            detail.assets.map((balance) => (
              <div
                key={`${balance.asset.issuer}:${balance.asset.assetName.toString()}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "30px minmax(0, 1fr)",
                  alignItems: "center",
                  columnGap: "var(--space-3)",
                  minWidth: 0,
                }}
              >
                <FramedAvatar seed={`asset:${balance.asset.issuer}:${balance.asset.name}`} size={30} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
                    <AssetMetaLabel asset={balance.asset} amount={balance.amount} />
                  </span>
                  <span style={MONO_META} title={balance.asset.issuer}>
                    {truncateId(balance.asset.issuer, 8, 8)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {fees ? (
        <HoldingFeeWarning
          fees={fees}
          balance={detail.balance}
          hasAssets={detail.assets.length > 0}
        />
      ) : null}

      {detail.assets.length > 0 && detail.balance < MSVAULT_REVOKE_FEE ? (
        <InlineNotice tone="warning">Asset releases need at least 100 QU in the vault.</InlineNotice>
      ) : null}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Button
          size="md"
          style={{ width: "auto", flex: "1 1 140px" }}
          disabled={actionsDisabled}
          onClick={() => navigate(`/multisig/${rawId}/deposit`)}
        >
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
          Request release
        </Button>
      </div>

      <Section title="Owners">
        <div className="settings-menu corner-frame" style={{ display: "flex", flexDirection: "column" }}>
          {detail.owners.map((owner, index) => (
            <div
              key={owner}
              className="settings-menu-row"
              style={{ cursor: "default", gap: "var(--space-3)", alignItems: "center" }}
            >
              <FramedAvatar seed={owner} size={30} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
                    <IdentityName identity={owner} contacts={contacts} wallet={wallet} sessionAccounts={sessionAccounts} />
                  </span>
                  {ownerIndex([owner], identity) >= 0 ? <Tag variant="neutral">You</Tag> : null}
                </span>
                <span style={MONO_META} title={owner}>{truncateId(owner, 10, 10)}</span>
              </div>
              <span style={MONO_META}>Owner {index + 1}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Approvals">
        {detail.proposals.length === 0 ? (
          <p style={BODY_COPY}>No release requests yet.</p>
        ) : (
          <>
            {qubicProposals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <h3 style={SECTION_LABEL}>QUBIC</h3>
                {qubicProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.key}
                    proposal={proposal}
                    detail={detail}
                    activeOwner={activeOwner}
                    contacts={contacts}
                    wallet={wallet}
                    sessionAccounts={sessionAccounts}
                    hasPending={hasPending}
                    feesReady={!!fees}
                    feesFailed={feesQuery.isError}
                    onApprove={(target) => navigate(approveHref(target))}
                    onWithdraw={(target) => {
                      setResetError("");
                      setResetTarget(target);
                    }}
                  />
                ))}
              </div>
            ) : null}

            {assetProposals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <h3 style={SECTION_LABEL}>Assets</h3>
                {assetProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.key}
                    proposal={proposal}
                    detail={detail}
                    activeOwner={activeOwner}
                    contacts={contacts}
                    wallet={wallet}
                    sessionAccounts={sessionAccounts}
                    hasPending={hasPending}
                    feesReady={!!fees}
                    feesFailed={feesQuery.isError}
                    onApprove={(target) => navigate(approveHref(target))}
                    onWithdraw={(target) => {
                      setResetError("");
                      setResetTarget(target);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </Section>

      {resetTarget ? (
        <MultisigConfirmSheet
          open
          title="Withdraw approval"
          description="This removes only this account's approval. The reset fee is paid by this account and is not refundable."
          details={
            <>
              <FeeRow label="Vault" value={<VaultId id={detail.id} />} />
              <FeeRow
                label="Release"
                value={
                  resetTarget.kind === "asset" && resetTarget.asset ? (
                    <AssetMetaLabel asset={resetTarget.asset} amount={resetTarget.amount} />
                  ) : (
                    `${formatQu(resetTarget.amount)} QU`
                  )
                }
              />
              <FeeRow
                label="Destination"
                value={identityDisplayName(resetTarget.destination, contacts, wallet, sessionAccounts)}
              />
            </>
          }
          feeLabel={fees ? `${formatQu(fees.releaseResetFee)} QU` : "Fees unavailable"}
          confirmLabel="Withdraw approval"
          sending={resetSending}
          error={resetError}
          onConfirm={() => void sendReset(resetTarget)}
          onClose={() => {
            if (resetSending) return;
            setResetTarget(null);
            setResetError("");
          }}
        />
      ) : null}
    </AppShell>
  );
}
