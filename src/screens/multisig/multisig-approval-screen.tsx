import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { ScreenHeader } from "@/components/screen-header";
import { TextButton } from "@/components/text-button";
import { useMsvaultDetail, useMsvaultFees } from "@/hooks/use-msvault";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { useTickInfo } from "@/hooks/use-tick-info";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { estimateTargetTick } from "@/lib/api/network";
import { MsvaultInactiveError } from "@/lib/api/msvault";
import { broadcastTx } from "@/lib/broadcast";
import {
  MSVAULT,
  MSVAULT_ADDRESS,
  MSVAULT_RELEASE_ASSET_TO_INPUT_TYPE,
  MSVAULT_RELEASE_TO_INPUT_TYPE,
  MSVAULT_RESET_ASSET_RELEASE_INPUT_TYPE,
  MSVAULT_RESET_RELEASE_INPUT_TYPE,
} from "@/lib/contracts";
import { extractMessage, formatQu } from "@/lib/format";
import { MSVAULT_REVOKE_FEE, ownerIndex, type MsvaultReleaseKind } from "@/lib/msvault";
import { qk } from "@/lib/query-keys";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { hasPendingFromAccount } from "@/screens/send/send-flow";
import { ArrowLeft01Icon, CheckmarkCircle01Icon } from "@/lib/icons";
import { ApprovalAddress } from "@/components/request/approval-address";
import { ApprovalAmount } from "@/components/request/approval-amount";
import { ApprovalField } from "@/components/request/approval-field";
import {
  AssetMetaLabel,
  FeeRow,
  HoldingFeeWarning,
  MultisigAccountSelect,
  MultisigFlowShell,
  identityDisplayName,
} from "./multisig-ui";

interface ApprovalParams {
  kind: MsvaultReleaseKind;
  amount: bigint | null;
  destination: string;
  assetIssuer: string;
  assetName: bigint;
  valid: boolean;
}

function readParams(searchParams: URLSearchParams): ApprovalParams {
  const kindParam = searchParams.get("kind");
  const kind: MsvaultReleaseKind = kindParam === "asset" ? "asset" : "qubic";
  const amountParam = searchParams.get("amount")?.trim() ?? "";
  const destination = searchParams.get("to")?.trim().toUpperCase() ?? "";
  const assetParam = searchParams.get("asset")?.trim() ?? "";

  let amount: bigint | null = null;
  if (/^\d+$/.test(amountParam)) {
    try {
      const value = BigInt(amountParam);
      amount = value > 0n ? value : null;
    } catch {
      amount = null;
    }
  }

  let assetIssuer = "";
  let assetName = 0n;
  if (assetParam) {
    const separator = assetParam.indexOf(":");
    if (separator > 0) {
      const issuer = assetParam.slice(0, separator).trim().toUpperCase();
      const name = assetParam.slice(separator + 1).trim();
      if (issuer && /^\d+$/.test(name)) {
        try {
          const parsed = BigInt(name);
          if (parsed > 0n) {
            assetIssuer = issuer;
            assetName = parsed;
          }
        } catch {
          assetIssuer = "";
        }
      }
    }
  }

  return {
    kind,
    amount,
    destination,
    assetIssuer,
    assetName,
    valid: (kindParam === "qubic" || kindParam === "asset") && amount !== null && !!destination,
  };
}

export default function MultisigApprovalScreen() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
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
    try { return BigInt(rawId); } catch { return null; }
  }, [rawId]);

  const paramsData = useMemo(() => readParams(searchParams), [searchParams]);
  const detailQuery = useMsvaultDetail(vaultId);
  const feesQuery = useMsvaultFees();
  const detail = detailQuery.data ?? null;
  const fees = feesQuery.data ?? null;

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState("");

  const header = (
    <ScreenHeader
      title="Approval request"
      onBack={() => navigate(`/multisig/${rawId}/approvals`)}
      backAriaLabel="Back to pending approvals"
    />
  );

  const proposal = detail?.proposals.find((candidate) => {
    if (!paramsData.valid || paramsData.amount === null) return false;
    if (candidate.kind !== paramsData.kind) return false;
    if (candidate.amount !== paramsData.amount) return false;
    if (candidate.destination.trim().toUpperCase() !== paramsData.destination) return false;
    if (paramsData.kind === "asset") {
      if (!candidate.asset) return false;
      return (
        candidate.asset.issuer.trim().toUpperCase() === paramsData.assetIssuer &&
        candidate.asset.assetName === paramsData.assetName
      );
    }
    return true;
  }) ?? null;

  const hasPending = hasPendingFromAccount(pendingTxs, identity);
  const activeOwner = detail ? ownerIndex(detail.owners, identity) : -1;
  const isOwner = activeOwner >= 0;
  const supportedByMe = isOwner && !!proposal && proposal.supporters.includes(activeOwner);
  const otherSupport = activeOwner >= 0
    ? detail?.proposals.find((candidate) => candidate.kind === proposal?.kind && candidate.supporters.includes(activeOwner)) ?? null
    : null;
  const replacesOther = !supportedByMe && !!otherSupport && otherSupport.key !== proposal?.key;

  const destinationName = proposal
    ? identityDisplayName(proposal.destination, contacts, wallet, sessionAccounts)
    : "";

  async function invalidate(vault: bigint) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.msvaultVault(apiIdentity, vault.toString()) }),
      queryClient.invalidateQueries({ queryKey: qk.msvaultVaults(apiIdentity, identity) }),
    ]);
  }

  async function approve() {
    if (!detail || !proposal || !fees || !tickInfo || !identity || !isOwner || supportedByMe || hasPending) return;
    setSending(true);
    setError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload = proposal.kind === "qubic"
        ? MSVAULT.encodeProcedure("releaseTo", {
            vaultId: detail.id,
            amount: proposal.amount,
            destination: proposal.destination,
          })
        : MSVAULT.encodeProcedure("releaseAssetTo", {
            vaultId: detail.id,
            asset: {
              issuer: proposal.asset!.issuer,
              assetName: proposal.asset!.assetName,
            },
            amount: proposal.amount,
            destination: proposal.destination,
          });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: MSVAULT_ADDRESS,
        inputType: proposal.kind === "qubic" ? MSVAULT_RELEASE_TO_INPUT_TYPE : MSVAULT_RELEASE_ASSET_TO_INPUT_TYPE,
        payload,
        amount: fees.releaseFee,
        targetTick,
        currentTick: tickInfo.tick,
      });
      await broadcastTx(encoded);
      addPendingTx({
        hash,
        source: identity,
        destination: MSVAULT_ADDRESS,
        amount: fees.releaseFee.toString(),
        targetTick,
        broadcastAt: Date.now(),
        contractName: proposal.kind === "qubic" ? "MSVault · Release" : "MSVault · Release asset",
      });
      await invalidate(detail.id);
      navigate(`/multisig/${rawId}/approvals`);
    } catch (cause) {
      setError(extractMessage(cause, "Broadcast failed."));
    } finally {
      setSending(false);
    }
  }

  async function withdraw() {
    if (!detail || !proposal || !fees || !tickInfo || !identity || !isOwner || !supportedByMe || hasPending) return;
    setResetSending(true);
    setResetError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload = MSVAULT.encodeProcedure(
        proposal.kind === "asset" ? "resetAssetRelease" : "resetRelease",
        { vaultId: detail.id },
      );
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: MSVAULT_ADDRESS,
        inputType: proposal.kind === "asset"
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
        contractName: proposal.kind === "asset" ? "MSVault · Reset asset release" : "MSVault · Reset release",
      });
      await invalidate(detail.id);
      setConfirmReset(false);
      navigate(`/multisig/${rawId}/approvals`);
    } catch (cause) {
      setResetError(extractMessage(cause, "Broadcast failed."));
    } finally {
      setResetSending(false);
    }
  }

  if (!vaultId) {
    return (
      <MultisigFlowShell statusBar={header}>
        <EmptyCollectionState title="Vault not found" description="This multisig vault could not be found." icon="search" />
      </MultisigFlowShell>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <MultisigFlowShell statusBar={header}>
        <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ height: 72, borderRadius: "var(--radius-sharp)", background: "var(--color-skeleton)" }} />
          ))}
        </div>
      </MultisigFlowShell>
    );
  }

  if (detailQuery.error instanceof MsvaultInactiveError) {
    return (
      <MultisigFlowShell statusBar={header}>
        <EmptyCollectionState title="This vault is inactive" description="Unpaid holding fees can close a vault." icon="activity" />
      </MultisigFlowShell>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <MultisigFlowShell statusBar={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
            {extractMessage(detailQuery.error, "Could not load this vault.")}
          </p>
          <Button size="sm" variant="secondary" onClick={() => void detailQuery.refetch()}>Retry</Button>
        </div>
      </MultisigFlowShell>
    );
  }

  if (!proposal) {
    return (
      <MultisigFlowShell
        statusBar={header}
        footer={(
          <Button size="md" onClick={() => navigate(`/multisig/${rawId}/approvals`)} style={{ width: "100%" }}>
            Back to approvals
          </Button>
        )}
      >
        <EmptyCollectionState title="Approval no longer pending" description="This release may have been approved or withdrawn." icon="activity" />
      </MultisigFlowShell>
    );
  }

  if (confirmReset) {
    const closeReset = () => {
      if (resetSending) return;
      setConfirmReset(false);
      setResetError("");
    };
    return (
      <MultisigFlowShell
        statusBar={<ScreenHeader title="Withdraw approval" onBack={closeReset} />}
        footer={(
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Button onClick={() => void withdraw()} loading={resetSending} disabled={!fees || resetSending || hasPending || !isOwner} style={{ width: "100%" }}>
              Withdraw approval
            </Button>
            <Button variant="secondary" size="md" onClick={closeReset} disabled={resetSending} style={{ width: "100%" }}>
              Cancel
            </Button>
          </div>
        )}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
            This removes only this account's approval. The reset fee is paid by this account and is not refundable.
          </p>
          <div className="corner-frame" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)", background: "var(--color-bg-surface)" }}>
              <FeeRow
              label="Release"
              value={proposal.kind === "asset" && proposal.asset
                ? <AssetMetaLabel asset={proposal.asset} amount={proposal.amount} />
                : `${formatQu(proposal.amount)} QU`}
            />
            <FeeRow label="Destination" value={destinationName} />
            <FeeRow label="Reset fee" value={fees ? `${formatQu(fees.releaseResetFee)} QU` : "Fees unavailable"} />
          </div>
          {resetError ? <p role="alert" style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>{resetError}</p> : null}
        </div>
      </MultisigFlowShell>
    );
  }

  const vaultAfterRelease = proposal.kind === "qubic"
    ? detail.balance - proposal.amount
    : detail.balance - MSVAULT_REVOKE_FEE;
  const assetReserveShort = proposal.kind === "asset" && detail.balance < MSVAULT_REVOKE_FEE;
  const approvalActionsDisabled = !isOwner || hasPending || !fees || assetReserveShort || sending;

  const footer = (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <Button
        variant="secondary"
        size="md"
        style={{ flex: "1 1 120px" }}
        disabled={sending || resetSending}
        onClick={() => navigate(`/multisig/${rawId}/approvals`)}
      >
        <ArrowLeft01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        Back
      </Button>
      {supportedByMe ? (
        <Button
          variant="danger"
          size="md"
          style={{ flex: "1 1 160px" }}
          disabled={!fees || resetSending}
          onClick={() => {
            setResetError("");
            setConfirmReset(true);
          }}
        >
          Withdraw approval
        </Button>
      ) : (
        <Button
          size="md"
          style={{ flex: "1 1 160px" }}
          loading={sending}
          disabled={approvalActionsDisabled}
          onClick={() => void approve()}
        >
          <CheckmarkCircle01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          {isOwner ? "Approve release" : "Only owners can approve"}
        </Button>
      )}
    </div>
  );

  return (
    <MultisigFlowShell statusBar={header} footer={footer}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <MultisigAccountSelect
          wallet={wallet}
          accounts={sessionAccounts}
          activeIndex={settings.activeAccountIndex}
          onSelect={setActiveAccountIndex}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-section)", lineHeight: "var(--leading-tight)", color: "var(--color-text-secondary)" }}>
            <span style={{ fontWeight: 600, color: "var(--color-text-display)" }}>
              {proposal.approvals === 1 ? "An owner" : `${proposal.approvals} owners`}
            </span>{" "}
            {proposal.approvals === 1 ? "wants" : "want"} to release{" "}
            <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>
              {proposal.kind === "asset" && proposal.asset
                ? <AssetMetaLabel asset={proposal.asset} amount={proposal.amount} />
                : `${formatQu(proposal.amount)} QU`}
            </span>{" "}
            to{" "}
            <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>{destinationName}</span>.
          </div>
        </div>

        {!isOwner ? (
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-status-warning)" }}>
            Only owners can approve releases. Switch to an owner account to continue.
          </p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {proposal.kind === "qubic" ? (
            <ApprovalAmount amount={proposal.amount} />
          ) : (
            <ApprovalField label="Amount">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-section)", color: "var(--color-text-primary)" }}>
                {proposal.asset ? <AssetMetaLabel asset={proposal.asset} amount={proposal.amount} /> : "—"}
              </span>
            </ApprovalField>
          )}

          <ApprovalAddress label="Destination" identity={proposal.destination} name={destinationName} compact="long" />

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <ApprovalField label="Current approvals">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
                {proposal.approvals} of {proposal.requiredApprovals}
              </span>
            </ApprovalField>
            <ApprovalField label="After approval">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
                {proposal.approvals + 1} of {proposal.requiredApprovals}
              </span>
            </ApprovalField>
            <ApprovalField label="Release fee">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
                {feesQuery.isLoading ? "Loading fees…" : fees ? `${formatQu(fees.releaseFee)} QU` : "Fees unavailable"}
              </span>
            </ApprovalField>
            <ApprovalField label="Vault QUBIC after release">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {formatQu(vaultAfterRelease)} QU
              </span>
            </ApprovalField>
          </div>

          {proposal.kind === "asset" ? (
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
              A successful asset release also deducts {formatQu(MSVAULT_REVOKE_FEE)} QU from the vault.
            </p>
          ) : null}

          {supportedByMe ? (
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)" }}>
              Your approval is already recorded.
            </p>
          ) : null}
          {replacesOther ? (
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)" }}>
              {proposal.kind === "qubic"
                ? "This replaces your current QUBIC approval."
                : "This replaces your current asset approval."}
            </p>
          ) : null}
          {assetReserveShort ? (
            <p role="alert" style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
              The vault needs at least {formatQu(MSVAULT_REVOKE_FEE)} QU for asset transfer fees.
            </p>
          ) : null}
          {fees ? (
            <HoldingFeeWarning
              fees={fees}
              balance={detail.balance}
              hasAssets={detail.assets.length > 0}
              releaseAmount={proposal.kind === "qubic" ? proposal.amount : undefined}
            />
          ) : null}
          {feesQuery.isError ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <span role="alert" style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>Fees unavailable</span>
              <TextButton onClick={() => void feesQuery.refetch()}>Retry</TextButton>
            </div>
          ) : null}
          {error ? <p role="alert" style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>{error}</p> : null}
          {hasPending ? (
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
              Wait for your pending transaction to confirm.
            </p>
          ) : null}
        </div>
      </div>
    </MultisigFlowShell>
  );
}
