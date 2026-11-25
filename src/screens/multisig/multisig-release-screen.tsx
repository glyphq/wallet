import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { ChoiceChips } from "@/components/choice-chips";
import { DropdownSelect } from "@/components/dropdown-select";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { AmountInput } from "@/components/amount-input";
import { Input } from "@/components/input";
import { TextButton } from "@/components/text-button";
import { ApprovalAddress } from "@/components/request/approval-address";
import { ApprovalAmount } from "@/components/request/approval-amount";
import { ApprovalField } from "@/components/request/approval-field";
import { useMsvaultAssetMeta, useMsvaultDetail, useMsvaultFees } from "@/hooks/use-msvault";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { useBalance } from "@/hooks/use-balance";
import { useTickInfo } from "@/hooks/use-tick-info";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { MsvaultInactiveError } from "@/lib/api/msvault";
import { estimateTargetTick } from "@/lib/api/network";
import { broadcastTx } from "@/lib/broadcast";
import {
  MSVAULT,
  MSVAULT_ADDRESS,
  MSVAULT_RELEASE_ASSET_TO_INPUT_TYPE,
  MSVAULT_RELEASE_TO_INPUT_TYPE,
} from "@/lib/contracts";
import { IdentityPickerScreen } from "@/components/identity-picker";
import { isValidIdentity } from "@/lib/crypto";
import { extractMessage, formatQu, truncateId } from "@/lib/format";
import {
  MSVAULT_REVOKE_FEE,
  decodeAssetName,
  formatAssetAmount,
  ownerIndex,
  parseAssetAmount,
  type MsvaultAssetRef,
  type MsvaultReleaseKind,
} from "@/lib/msvault";
import { qk } from "@/lib/query-keys";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { hasPendingFromAccount } from "@/screens/send/send-flow";
import { UserGroupIcon } from "@/lib/icons";
import {
  AssetMetaLabel,
  FeeRow,
  HoldingFeeWarning,
  MultisigFlowShell,
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
  gap: "var(--space-4)",
  padding: "var(--space-4)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-sharp)",
  background: "var(--color-bg-surface)",
};

function parseWholeQu(text: string): bigint | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  try {
    const value = BigInt(trimmed);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

function assetKeyOf(asset: MsvaultAssetRef): string {
  return `${asset.issuer.trim().toUpperCase()}:${asset.assetName.toString()}`;
}

function assetAmountInput(shares: bigint, decimals: number): string {
  if (decimals <= 0) return shares.toString();
  const base = 10n ** BigInt(decimals);
  const whole = shares / base;
  const fraction = (shares % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

interface InitialParams {
  kind: MsvaultReleaseKind;
  kindValid: boolean;
  rawAmount: bigint | null;
  destination: string;
  assetIssuer: string;
  assetName: bigint;
  complete: boolean;
}

function readInitialParams(searchParams: URLSearchParams): InitialParams {
  const kindParam = searchParams.get("kind");
  const amountParam = searchParams.get("amount")?.trim() ?? "";
  const to = searchParams.get("to")?.trim().toUpperCase() ?? "";
  const assetParam = searchParams.get("asset")?.trim() ?? "";

  const kindValid = kindParam === "qubic" || kindParam === "asset";
  const kind: MsvaultReleaseKind = kindParam === "asset" ? "asset" : "qubic";

  let rawAmount: bigint | null = null;
  if (/^\d+$/.test(amountParam)) {
    try {
      const value = BigInt(amountParam);
      rawAmount = value > 0n ? value : null;
    } catch {
      rawAmount = null;
    }
  }

  let assetIssuer = "";
  let assetName = 0n;
  if (assetParam) {
    const separator = assetParam.indexOf(":");
    if (separator > 0) {
      const issuerPart = assetParam.slice(0, separator).trim().toUpperCase();
      const namePart = assetParam.slice(separator + 1).trim();
      if (issuerPart && /^\d+$/.test(namePart)) {
        try {
          const parsed = BigInt(namePart);
          if (parsed > 0n) {
            assetIssuer = issuerPart;
            assetName = parsed;
          }
        } catch {
          assetIssuer = "";
        }
      }
    }
  }

  const assetValid = !kindParam || kind !== "asset" || (!!assetIssuer && assetName > 0n);
  const complete =
    kindValid && rawAmount !== null && !!to && isValidIdentity(to) && assetValid;

  return {
    kind,
    kindValid,
    rawAmount,
    destination: to,
    assetIssuer,
    assetName,
    complete,
  };
}

export default function MultisigReleaseScreen() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const settings = usePersistedStore((s) => s.settings);
  const wallets = usePersistedStore((s) => s.wallets);
  const contacts = usePersistedStore((s) => s.contacts);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const sessionAccounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const identity = getWalletAccountIdentity(wallet, settings.activeAccountIndex, sessionAccounts) ?? "";
  const apiIdentity = useApiCacheIdentity();
  const { data: tickInfo } = useTickInfo();
  const { data: balanceData } = useBalance(identity || null);
  const accountBalance = balanceData?.balance ?? null;

  const rawId = params.id ?? "";
  const vaultId = useMemo(() => {
    if (!/^\d+$/.test(rawId)) return null;
    try {
      return BigInt(rawId);
    } catch {
      return null;
    }
  }, [rawId]);

  const initial = useMemo(() => readInitialParams(searchParams), [searchParams]);

  const detailQuery = useMsvaultDetail(vaultId);
  const feesQuery = useMsvaultFees();
  const detail = detailQuery.data ?? null;
  const fees = feesQuery.data ?? null;

  const [kind, setKind] = useState<MsvaultReleaseKind>(initial.kindValid ? initial.kind : "qubic");
  const [amountText, setAmountText] = useState(
    initial.kind === "qubic" && initial.rawAmount !== null ? initial.rawAmount.toString() : "",
  );
  const [destination, setDestination] = useState(initial.destination);
  const [assetKey, setAssetKey] = useState(
    initial.kind === "asset" && initial.assetIssuer && initial.assetName > 0n
      ? `${initial.assetIssuer}:${initial.assetName.toString()}`
      : "",
  );
  const [review, setReview] = useState(initial.complete);
  const [queryReview, setQueryReview] = useState(initial.complete);
  const [showErrors, setShowErrors] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const assetBalances = detail?.assets ?? [];
  const reviewAssetKey =
    queryReview && initial.kind === "asset" && initial.assetIssuer && initial.assetName > 0n
      ? `${initial.assetIssuer}:${initial.assetName.toString()}`
      : "";
  const chosenAssetKey =
    (queryReview ? reviewAssetKey : assetKey) ||
    (assetBalances[0] ? assetKeyOf(assetBalances[0].asset) : "");

  const selectedBalance =
    assetBalances.find((balance) => assetKeyOf(balance.asset) === chosenAssetKey) ?? null;
  const fallbackAsset: MsvaultAssetRef | null =
    queryReview && initial.kind === "asset" && initial.assetIssuer && initial.assetName > 0n
      ? {
          issuer: initial.assetIssuer,
          assetName: initial.assetName,
          name: decodeAssetName(initial.assetName),
        }
      : null;
  const selectedAsset = selectedBalance?.asset ?? fallbackAsset;

  const metaQuery = useMsvaultAssetMeta(selectedAsset);
  const assetDecimals = metaQuery.data?.decimals ?? 0;
  const assetEditPending = review && kind === "asset" && metaQuery.isLoading;

  const rawAmount = queryReview
    ? initial.rawAmount
    : kind === "qubic"
      ? parseWholeQu(amountText)
      : selectedAsset
        ? parseAssetAmount(amountText, assetDecimals)
        : null;

  const destUpper = destination.trim().toUpperCase();
  const destinationDisplayName = identityDisplayName(destUpper, contacts, wallet, sessionAccounts);
  const destinationName =
    destUpper && destinationDisplayName !== truncateId(destUpper)
      ? destinationDisplayName
      : undefined;
  const hasPending = hasPendingFromAccount(pendingTxs, identity);
  const activeOwner = detail ? ownerIndex(detail.owners, identity) : -1;
  const isOwner = activeOwner >= 0;
  const hasAssets = assetBalances.length > 0;

  function proposalMatches(proposalKind: MsvaultReleaseKind, asset: MsvaultAssetRef | null): boolean {
    if (proposalKind !== kind) return false;
    if (rawAmount === null) return false;
    if (kind === "asset") {
      if (!asset || !selectedAsset) return false;
      return (
        asset.issuer.trim().toUpperCase() === selectedAsset.issuer.trim().toUpperCase() &&
        asset.assetName === selectedAsset.assetName
      );
    }
    return true;
  }

  const proposal =
    detail?.proposals.find(
      (candidate) =>
        proposalMatches(candidate.kind, candidate.asset) &&
        candidate.amount === rawAmount &&
        candidate.destination.trim().toUpperCase() === destUpper,
    ) ?? null;

  const exactSupport = activeOwner >= 0 && !!proposal && proposal.supporters.includes(activeOwner);
  const otherSupport =
    activeOwner >= 0
      ? detail?.proposals.find(
          (candidate) => candidate.kind === kind && candidate.supporters.includes(activeOwner),
        ) ?? null
      : null;
  const replacesOther = !exactSupport && !!otherSupport && otherSupport.key !== proposal?.key;

  const requiredApprovals = proposal?.requiredApprovals ?? detail?.requiredApprovals ?? 0;
  const currentApprovals = proposal?.approvals ?? 0;

  const assetReserveShort = kind === "asset" && !!detail && detail.balance < MSVAULT_REVOKE_FEE;

  const amountValidation = (() => {
    if (rawAmount === null) {
      return kind === "qubic" ? "Enter a whole amount." : "Enter a positive amount.";
    }
    if (kind === "qubic" && detail && rawAmount > detail.balance) {
      return "Amount exceeds the vault balance.";
    }
    if (kind === "asset") {
      if (!selectedBalance) return "This asset is not held by the vault.";
      if (rawAmount > selectedBalance.amount) return "Amount exceeds the vault asset balance.";
    }
    return "";
  })();
  const destinationValidation = !destUpper
    ? "Enter a destination."
    : !isValidIdentity(destUpper)
      ? "Invalid address."
      : "";

  const amountError = showErrors || amountText.trim() ? amountValidation : "";
  const destinationError =
    showErrors || destination.trim() ? destinationValidation : "";

  const feesReady = !!fees;
  const releaseFeeShort = !!fees && accountBalance !== null && accountBalance < fees.releaseFee;
  const releaseFeeShortfall = fees && accountBalance !== null ? fees.releaseFee - accountBalance : 0n;
  const totalDisabledReason = hasPending
    ? "Wait for your pending transaction to confirm."
    : feesQuery.isLoading
      ? "Loading fees…"
      : feesQuery.isError
        ? "Fees unavailable."
        : releaseFeeShort
          ? `Need ${formatQu(releaseFeeShortfall)} more QU for the release fee.`
          : amountValidation || destinationValidation;

  const canReview = !amountValidation && !destinationValidation;
  const canSubmit =
    !!detail &&
    feesReady &&
    !!tickInfo &&
    isOwner &&
    !hasPending &&
    !sending &&
    !exactSupport &&
    !assetReserveShort &&
    !releaseFeeShort &&
    canReview;

  const vaultAfterRelease =
    detail && rawAmount !== null
      ? kind === "qubic"
        ? detail.balance - rawAmount
        : detail.balance - MSVAULT_REVOKE_FEE
      : null;

  const pickerAccounts = (wallet?.accounts ?? [])
    .filter((account) => !account.hidden)
    .map((account) => ({
      name: account.name,
      identity: getWalletAccountIdentity(wallet, account.index, sessionAccounts) ?? "",
    }))
    .filter((account) => account.identity && account.identity !== identity);

  const assetOptions = assetBalances
    .slice()
    .sort((a, b) => a.asset.name.localeCompare(b.asset.name));

  async function submitRelease() {
    if (!detail || !fees || rawAmount === null || !tickInfo || !identity || !isOwner) return;
    if (kind === "asset" && (!selectedAsset || !selectedBalance)) return;
    if (accountBalance !== null && accountBalance < fees.releaseFee) {
      setError(`Not enough QU for the ${formatQu(fees.releaseFee)} QU release fee.`);
      return;
    }

    setSending(true);
    setError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload =
        kind === "qubic"
          ? MSVAULT.encodeProcedure("releaseTo", {
              vaultId: detail.id,
              amount: rawAmount,
              destination: destUpper,
            })
          : MSVAULT.encodeProcedure("releaseAssetTo", {
              vaultId: detail.id,
              asset: {
                issuer: selectedAsset!.issuer,
                assetName: selectedAsset!.assetName,
              },
              amount: rawAmount,
              destination: destUpper,
            });

      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: MSVAULT_ADDRESS,
        inputType:
          kind === "qubic" ? MSVAULT_RELEASE_TO_INPUT_TYPE : MSVAULT_RELEASE_ASSET_TO_INPUT_TYPE,
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
        contractName: kind === "qubic" ? "MSVault · Release" : "MSVault · Release asset",
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: qk.msvaultVault(apiIdentity, detail.id.toString()),
        }),
        queryClient.invalidateQueries({ queryKey: qk.msvaultVaults(apiIdentity, identity) }),
      ]);
      navigate(`/multisig/${rawId}`);
    } catch (submitError) {
      setError(extractMessage(submitError, "Broadcast failed."));
    } finally {
      setSending(false);
    }
  }

  const footer = review ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <Button onClick={() => void submitRelease()} loading={sending} disabled={!canSubmit}>
        {proposal ? "Approve release" : "Request release"}
      </Button>
      <TextButton
        tone="muted"
        disabled={sending || assetEditPending}
        onClick={() => {
          if (rawAmount !== null) {
            setAmountText(
              kind === "qubic" ? rawAmount.toString() : assetAmountInput(rawAmount, assetDecimals),
            );
          }
          setQueryReview(false);
          setReview(false);
          setShowErrors(false);
          setError("");
        }}
      >
        Edit details
      </TextButton>
    </div>
  ) : (
    <Button
      onClick={() => {
        setShowErrors(true);
        if (canReview) {
          setQueryReview(false);
          setReview(true);
        }
      }}
      disabled={!canReview || !isOwner}
    >
      Review release
    </Button>
  );

  if (!vaultId) {
    return (
      <MultisigFlowShell>
        <EmptyCollectionState
          title="Vault not found"
          description="This multisig vault could not be found."
          icon="search"
        />
      </MultisigFlowShell>
    );
  }

  if (detailQuery.error instanceof MsvaultInactiveError) {
    return (
      <MultisigFlowShell>
        <EmptyCollectionState
          title="This vault is inactive"
          description="Unpaid holding fees can close a vault. It can no longer approve releases."
          icon="activity"
        />
      </MultisigFlowShell>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <MultisigFlowShell>
        <div aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ height: 72, borderRadius: "var(--radius-sharp)", background: "var(--color-skeleton)" }} />
          ))}
        </div>
      </MultisigFlowShell>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <MultisigFlowShell>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>
            {extractMessage(detailQuery.error, "Could not load this vault.")}
          </p>
          <Button size="sm" variant="secondary" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </div>
      </MultisigFlowShell>
    );
  }

  if (pickerOpen) {
    return (
      <IdentityPickerScreen
        title="Choose recipient"
        contacts={contacts}
        accounts={pickerAccounts}
        onSelect={(selectedIdentity) => {
          setDestination(selectedIdentity);
          setShowErrors(false);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    );
  }

  return (
    <MultisigFlowShell footer={footer}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={SECTION_LABEL}>{review ? "Approve release from" : "Request release from"}</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap", minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
              {detail.name.trim() || "Unnamed vault"}
            </span>
            <VaultId id={detail.id} />
          </span>
        </div>

        {!isOwner ? (
          <div
            role="status"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--color-status-warning)",
              borderRadius: "var(--radius-sharp)",
              background: "var(--color-status-warning-soft)",
            }}
          >
            <p style={{ ...BODY_COPY, color: "var(--color-status-warning)" }}>
              Only owners can approve releases. Switch to an owner account to continue.
            </p>
          </div>
        ) : null}

        {review ? (
          <section className="corner-frame" style={CARD} aria-label="Release review">
            {kind === "qubic" && rawAmount !== null ? (
              <ApprovalAmount amount={rawAmount} />
            ) : (
              <ApprovalField label="Amount">
                {selectedAsset && rawAmount !== null ? (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-section)", color: "var(--color-text-primary)" }}>
                    <AssetMetaLabel asset={selectedAsset} amount={rawAmount} />
                  </span>
                ) : (
                  <span style={MONO_META}>—</span>
                )}
              </ApprovalField>
            )}

            <ApprovalField label="Vault">
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
                {detail.name.trim() || "Unnamed vault"}
              </span>
              <VaultId id={detail.id} />
            </ApprovalField>

            {kind === "asset" && selectedAsset ? (
              <ApprovalField label="Asset">
                <AssetMetaLabel asset={selectedAsset} />
              </ApprovalField>
            ) : null}

            <ApprovalAddress
              label="Destination"
              identity={destUpper}
              name={destinationName}
            />

            <ApprovalField label="Approvals">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
                {currentApprovals} of {requiredApprovals}
              </span>
              <span style={{ ...MONO_META, color: "var(--color-text-secondary)" }}>
                After approval: {currentApprovals + 1} of {requiredApprovals}
              </span>
            </ApprovalField>

            <ApprovalField label="Release fee">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)" }}>
                {feesQuery.isLoading
                  ? "Loading fees…"
                  : fees
                    ? `${formatQu(fees.releaseFee)} QU`
                    : "Fees unavailable"}
              </span>
              <span style={MONO_META}>Paid by this account</span>
            </ApprovalField>
            {releaseFeeShort ? (
              <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>
                Need {formatQu(releaseFeeShortfall)} more QU in this account for the release fee.
              </p>
            ) : null}

            <ApprovalField label="Vault QUBIC after release">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", fontVariantNumeric: "tabular-nums" }}>
                {vaultAfterRelease !== null ? `${formatQu(vaultAfterRelease)} QU` : "—"}
              </span>
            </ApprovalField>

            {kind === "asset" ? (
              <p style={BODY_COPY}>
                A successful asset release also deducts {formatQu(MSVAULT_REVOKE_FEE)} QU from the vault.
              </p>
            ) : null}

            {exactSupport ? (
              <p style={{ ...BODY_COPY, color: "var(--color-status-warning)" }}>
                You already approved this release.
              </p>
            ) : null}

            {replacesOther ? (
              <p style={{ ...BODY_COPY, color: "var(--color-status-warning)" }}>
                {kind === "qubic"
                  ? "This replaces your current QUBIC approval."
                  : "This replaces your current asset approval."}
              </p>
            ) : null}

            {assetReserveShort ? (
              <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>
                The vault needs at least {formatQu(MSVAULT_REVOKE_FEE)} QU for asset transfer fees.
              </p>
            ) : null}

            {fees ? (
              <HoldingFeeWarning
                fees={fees}
                balance={detail.balance}
                hasAssets={hasAssets}
                releaseAmount={kind === "qubic" ? (rawAmount ?? undefined) : undefined}
              />
            ) : null}

            {feesQuery.isError ? (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>Fees unavailable</span>
                <TextButton onClick={() => void feesQuery.refetch()}>Retry</TextButton>
              </div>
            ) : null}

            {totalDisabledReason && !canSubmit ? (
              <p style={BODY_COPY}>{totalDisabledReason}</p>
            ) : null}

            {hasPending ? (
              <p style={BODY_COPY}>Wait for your pending transaction to confirm.</p>
            ) : null}

            {error ? (
              <p role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>{error}</p>
            ) : null}
          </section>
        ) : (
          <>
            <ChoiceChips
              label="Release type"
              options={[
                { value: "qubic", label: "QUBIC" },
                { value: "asset", label: "Asset" },
              ]}
              selected={kind}
              onSelect={(value) => {
                setKind(value);
                setAmountText("");
                setShowErrors(false);
                setError("");
              }}
              disabled={sending}
            />

            {kind === "qubic" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <AmountInput
                  label="Amount"
                  autoComplete="off"
                  value={amountText}
                  onValueChange={(value) => {
                    setAmountText(value);
                    setError("");
                  }}
                  placeholder="0"
                  error={amountError}
                />
                <p style={BODY_COPY}>
                  Vault QUBIC balance: {formatQu(detail.balance)} QU
                </p>
              </div>
            ) : (
              <>
                {assetOptions.length === 0 ? (
                  <EmptyCollectionState
                    title="No vault assets"
                    description="Deposit an asset before releasing it."
                    icon="apps"
                  />
                ) : (
                  <>
                    <DropdownSelect
                      id="release-asset"
                      label="Asset"
                      value={chosenAssetKey}
                      options={assetOptions.map((balance) => ({
                        value: assetKeyOf(balance.asset),
                        label: balance.asset.name,
                      }))}
                      onChange={(value) => {
                        setAssetKey(value);
                        setAmountText("");
                        setShowErrors(false);
                        setError("");
                      }}
                    />
                    {selectedBalance ? (
                      <p style={BODY_COPY}>
                        Vault balance: {formatAssetAmount(selectedBalance.amount, assetDecimals)}
                      </p>
                    ) : null}
                    <AmountInput
                      label="Amount"
                      autoComplete="off"
                      value={amountText}
                      decimals={assetDecimals}
                      onValueChange={(value) => {
                        setAmountText(value);
                        setError("");
                      }}
                      placeholder="0"
                      error={amountError}
                    />
                  </>
                )}
              </>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Input
                label="Destination"
                value={destination}
                onChange={(event) => {
                  setDestination(event.target.value);
                  setError("");
                }}
                placeholder="Address or contact"
                autoComplete="off"
                error={destinationError}
                rightElement={
                  pickerAccounts.length > 0 || contacts.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      aria-label="Choose recipient"
                      style={{
                        border: 0,
                        background: "transparent",
                        padding: 0,
                        display: "flex",
                        color: "var(--color-text-tertiary)",
                        cursor: "pointer",
                      }}
                    >
                      <UserGroupIcon size={18} aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
              {destUpper ? (
                <p style={MONO_META} title={destUpper}>
                  {truncateId(destUpper, 10, 10)}
                </p>
              ) : null}
            </div>

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <h2 style={SECTION_LABEL}>Approval</h2>
              <FeeRow label="Current approvals" value={`${currentApprovals} of ${requiredApprovals}`} />
              <FeeRow label="After approval" value={`${currentApprovals + 1} of ${requiredApprovals}`} />
              <FeeRow
                label="Release fee"
                hint="Paid by this account"
                value={
                  feesQuery.isLoading
                    ? "Loading fees…"
                    : fees
                      ? `${formatQu(fees.releaseFee)} QU`
                      : "Fees unavailable"
                }
              />
              {exactSupport ? (
                <p style={{ ...BODY_COPY, color: "var(--color-status-warning)" }}>
                  You already approved this release.
                </p>
              ) : null}
              {replacesOther ? (
                <p style={{ ...BODY_COPY, color: "var(--color-status-warning)" }}>
                  {kind === "qubic"
                    ? "This replaces your current QUBIC approval."
                    : "This replaces your current asset approval."}
                </p>
              ) : null}
              {assetReserveShort ? (
                <p style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>
                  The vault needs at least {formatQu(MSVAULT_REVOKE_FEE)} QU for asset transfer fees.
                </p>
              ) : null}
              {kind === "asset" ? (
                <p style={BODY_COPY}>
                  A successful asset release also deducts {formatQu(MSVAULT_REVOKE_FEE)} QU from the vault.
                </p>
              ) : null}
              {fees ? (
                <HoldingFeeWarning
                  fees={fees}
                  balance={detail.balance}
                  hasAssets={hasAssets}
                  releaseAmount={kind === "qubic" ? (rawAmount ?? undefined) : undefined}
                />
              ) : null}
              {feesQuery.isError ? (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>Fees unavailable</span>
                  <TextButton onClick={() => void feesQuery.refetch()}>Retry</TextButton>
                </div>
              ) : null}
            </section>
          </>
        )}

        {!review && !isOwner ? (
          <p style={BODY_COPY}>Only owners can request or approve releases.</p>
        ) : null}
      </div>
    </MultisigFlowShell>
  );
}
