import { useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { AssetMetaLabel } from "./multisig-ui";
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
import { ownerIndex, type MsvaultDetail, type MsvaultProposal } from "@/lib/msvault";
import { qk } from "@/lib/query-keys";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { hasPendingFromAccount } from "@/screens/send/send-flow";
import {
  FeeRow,
  MultisigAccountSelect,
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
  const destinationName = identityDisplayName(proposal.destination, contacts, wallet, sessionAccounts);

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
            <Tag variant="neutral">Your approval</Tag>
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

export default function MultisigApprovalsScreen() {
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
  const vaultId = /^\d+$/.test(rawId) ? BigInt(rawId) : null;
  const detailQuery = useMsvaultDetail(vaultId);
  const feesQuery = useMsvaultFees();
  const detail = detailQuery.data ?? null;
  const fees = feesQuery.data ?? null;

  const [resetTarget, setResetTarget] = useState<MsvaultProposal | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState("");

  const header = (
    <ScreenHeader
      title="Pending approvals"
      onBack={() => navigate(`/multisig/${rawId}`)}
      backAriaLabel="Back to vault"
    />
  );

  const hasPending = hasPendingFromAccount(pendingTxs, identity);
  const activeOwner = detail ? ownerIndex(detail.owners, identity) : -1;

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
        <EmptyCollectionState title="Vault not found" description="This multisig vault could not be found." icon="search" />
      </AppShell>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <AppShell statusBar={header}>
        <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ height: 72, borderRadius: "var(--radius-sharp)", background: "var(--color-skeleton)" }} />
          ))}
        </div>
      </AppShell>
    );
  }

  if (detailQuery.error instanceof MsvaultInactiveError) {
    return (
      <AppShell statusBar={header}>
        <EmptyCollectionState title="This vault is inactive" description="Unpaid holding fees can close a vault." icon="activity" />
      </AppShell>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <AppShell statusBar={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>{extractMessage(detailQuery.error, "Could not load this vault.")}</p>
          <Button size="sm" variant="secondary" onClick={() => void detailQuery.refetch()}>Retry</Button>
        </div>
      </AppShell>
    );
  }

  if (resetTarget) {
    const closeReset = () => {
      if (resetSending) return;
      setResetTarget(null);
      setResetError("");
    };
    return (
      <AppShell
        statusBar={<ScreenHeader title="Withdraw approval" onBack={closeReset} />}
        contentStyle={{ padding: "var(--space-4)", paddingBottom: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
      >
        <p style={BODY_COPY}>
          This removes only this account's approval. The reset fee is paid by this account and is not refundable.
        </p>
        <div className="corner-frame" style={CARD}>
          <FeeRow label="Vault" value={<VaultId id={detail.id} />} />
          <FeeRow
            label="Release"
            value={resetTarget.kind === "asset" && resetTarget.asset
              ? <AssetMetaLabel asset={resetTarget.asset} amount={resetTarget.amount} />
              : `${formatQu(resetTarget.amount)} QU`}
          />
          <FeeRow label="Destination" value={identityDisplayName(resetTarget.destination, contacts, wallet, sessionAccounts)} />
          <FeeRow label="Reset fee" value={fees ? `${formatQu(fees.releaseResetFee)} QU` : "Fees unavailable"} />
        </div>
        {resetError ? <p role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>{resetError}</p> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Button onClick={() => void sendReset(resetTarget)} loading={resetSending} disabled={!fees || resetSending} style={{ width: "100%" }}>
            Withdraw approval
          </Button>
          <Button variant="secondary" size="md" onClick={closeReset} disabled={resetSending} style={{ width: "100%" }}>
            Cancel
          </Button>
        </div>
      </AppShell>
    );
  }

  const qubicProposals = detail.proposals.filter((proposal) => proposal.kind === "qubic");
  const assetProposals = detail.proposals.filter((proposal) => proposal.kind === "asset");

  return (
    <AppShell
      statusBar={header}
      contentStyle={{ padding: "var(--space-4)", paddingBottom: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}
    >
      <MultisigAccountSelect
        wallet={wallet}
        accounts={sessionAccounts}
        activeIndex={settings.activeAccountIndex}
        onSelect={setActiveAccountIndex}
      />

      {detail.proposals.length === 0 ? (
        <EmptyCollectionState title="No pending approvals" description="Releases requested by owners appear here." icon="activity" />
      ) : (
        <>
          {qubicProposals.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} aria-label="QUBIC approvals">
              <h2 style={SECTION_LABEL}>QUBIC</h2>
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
                  onWithdraw={(target) => { setResetError(""); setResetTarget(target); }}
                />
              ))}
            </section>
          ) : null}
          {assetProposals.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} aria-label="Asset approvals">
              <h2 style={SECTION_LABEL}>Assets</h2>
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
                  onWithdraw={(target) => { setResetError(""); setResetTarget(target); }}
                />
              ))}
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
