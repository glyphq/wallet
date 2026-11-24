import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { ChoiceChips } from "@/components/choice-chips";
import { DropdownSelect } from "@/components/dropdown-select";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { Input } from "@/components/input";
import { TextButton } from "@/components/text-button";
import { ApprovalDisclosure, ApprovalField } from "@/components/request/approval-field";
import { useBalance } from "@/hooks/use-balance";
import { useOwnedAssets } from "@/hooks/use-owned-assets";
import {
  useMsvaultAssetMeta,
  useMsvaultDetail,
  useMsvaultFees,
  useMsvaultManagedAsset,
} from "@/hooks/use-msvault";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
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
  MSVAULT_CONTRACT_INDEX,
  MSVAULT_DEPOSIT_ASSET_INPUT_TYPE,
  MSVAULT_DEPOSIT_INPUT_TYPE,
  MSVAULT_REVOKE_ASSET_MANAGEMENT_RIGHTS_INPUT_TYPE,
  QX,
  QX_ADDRESS,
  QX_CONTRACT_INDEX,
  QX_TRANSFER_SHARE_MANAGEMENT_RIGHTS_INPUT_TYPE,
} from "@/lib/contracts";
import { extractMessage, formatQu } from "@/lib/format";
import {
  MSVAULT_MAX_ASSET_TYPES,
  MSVAULT_REVOKE_FEE,
  decodeAssetName,
  encodeAssetName,
  formatAssetAmount,
  parseAssetAmount,
  type MsvaultAssetRef,
} from "@/lib/msvault";
import { qk } from "@/lib/query-keys";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { hasPendingFromAccount } from "@/screens/send/send-flow";
import {
  AssetMetaLabel,
  FeeRow,
  MultisigAccountSelect,
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

const CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: "var(--space-4)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-sharp)",
  background: "var(--color-bg-surface)",
};

interface AssetOption {
  key: string;
  asset: MsvaultAssetRef;
  shares: bigint;
  decimals: number;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} aria-label={title}>
      <h2 style={SECTION_LABEL}>{title}</h2>
      {children}
    </section>
  );
}

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

function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      style={{
        padding: "var(--space-2) var(--space-3)",
        border: "1px solid var(--color-border-default)",
        borderRadius: "var(--radius-sharp)",
        background: "var(--color-bg-subtle)",
      }}
    >
      <p style={{ ...BODY_COPY, color: "var(--color-text-primary)" }}>{children}</p>
    </div>
  );
}

export default function MultisigDepositScreen() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();

  const settings = usePersistedStore((s) => s.settings);
  const wallets = usePersistedStore((s) => s.wallets);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const sessionAccounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const identity = getWalletAccountIdentity(wallet, settings.activeAccountIndex, sessionAccounts) ?? "";
  const apiIdentity = useApiCacheIdentity();
  const { data: tickInfo } = useTickInfo();
  const { data: balanceData } = useBalance(identity || null);
  const walletBalance = balanceData?.balance ?? null;

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

  const [mode, setMode] = useState<"qubic" | "asset">("qubic");
  const [amountText, setAmountText] = useState("");
  const [assetKey, setAssetKey] = useState("");
  const [assetAmount, setAssetAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accessMode, setAccessMode] = useState<"grant" | "revoke" | null>(null);
  const [accessSending, setAccessSending] = useState(false);
  const [accessError, setAccessError] = useState("");

  const ownedAssetsQuery = useOwnedAssets(identity || null);
  const ownedAssets = ownedAssetsQuery.data;

  const { assetOptions, excludedCount } = useMemo(() => {
    const allowedManagers = new Set([0, QX_CONTRACT_INDEX, MSVAULT_CONTRACT_INDEX]);
    const map = new Map<string, AssetOption>();
    let excluded = 0;

    for (const item of ownedAssets ?? []) {
      if (!allowedManagers.has(item.managingContractIndex)) {
        excluded += 1;
        continue;
      }

      let assetName: bigint;
      try {
        assetName = encodeAssetName(item.name);
      } catch {
        continue;
      }

      let shares: bigint;
      try {
        shares = BigInt(item.numberOfUnits);
      } catch {
        continue;
      }
      if (shares <= 0n) continue;

      const issuer = item.issuerIdentity.trim().toUpperCase();
      if (!issuer) continue;

      const key = `${issuer}:${assetName.toString()}`;
      const existing = map.get(key);
      if (existing) {
        existing.shares += shares;
        if (existing.decimals === 0 && item.numberOfDecimalPlaces > 0) {
          existing.decimals = item.numberOfDecimalPlaces;
        }
        continue;
      }

      map.set(key, {
        key,
        asset: {
          issuer,
          assetName,
          name: decodeAssetName(assetName) || item.name.trim().toUpperCase(),
        },
        shares,
        decimals: item.numberOfDecimalPlaces,
      });
    }

    return {
      assetOptions: [...map.values()].sort((a, b) => a.asset.name.localeCompare(b.asset.name)),
      excludedCount: excluded,
    };
  }, [ownedAssets]);

  const selectedOption = assetOptions.find((option) => option.key === assetKey) ?? assetOptions[0] ?? null;
  const metaQuery = useMsvaultAssetMeta(selectedOption?.asset ?? null);
  const assetDecimals = metaQuery.data?.decimals ?? selectedOption?.decimals ?? 0;

  const managedQuery = useMsvaultManagedAsset(selectedOption?.asset ?? null, identity || null);
  const managedBalance = selectedOption ? (managedQuery.data ?? null) : null;

  const hasPending = hasPendingFromAccount(pendingTxs, identity);
  const qubicAmount = parseWholeQu(amountText);
  const depositFee = fees?.depositFee ?? null;
  const qubicTotal = qubicAmount !== null && depositFee !== null ? qubicAmount + depositFee : null;
  const qubicError =
    amountText.trim() && qubicAmount === null
      ? "Enter a whole amount."
      : qubicTotal !== null && walletBalance !== null && qubicTotal > walletBalance
        ? "Insufficient balance after the deposit fee."
        : "";

  const rawAssetAmount =
    selectedOption && assetAmount.trim() ? parseAssetAmount(assetAmount, assetDecimals) : null;
  const vaultAsset = detail?.assets.find(
    (balance) =>
      selectedOption &&
      balance.asset.issuer.trim().toUpperCase() === selectedOption.asset.issuer &&
      balance.asset.assetName === selectedOption.asset.assetName,
  );
  const assetTypeLimitReached =
    !!detail && detail.assets.length >= MSVAULT_MAX_ASSET_TYPES && !vaultAsset;
  const assetError =
    assetTypeLimitReached
      ? `This vault already holds the maximum of ${MSVAULT_MAX_ASSET_TYPES} asset types.`
      : assetAmount.trim() && rawAssetAmount === null
        ? `Enter a positive amount with at most ${assetDecimals} decimal places.`
        : rawAssetAmount !== null && selectedOption && rawAssetAmount > selectedOption.shares
          ? "Amount exceeds your wallet balance."
          : "";
  const grantAmount =
    rawAssetAmount !== null && managedBalance !== null && managedBalance < rawAssetAmount
      ? rawAssetAmount - managedBalance
      : null;
  const assetAction =
    rawAssetAmount !== null && managedBalance !== null
      ? managedBalance >= rawAssetAmount
        ? "deposit"
        : "grant"
      : null;

  const qubicDisabled =
    !detail ||
    hasPending ||
    sending ||
    !fees ||
    walletBalance === null ||
    qubicAmount === null ||
    !!qubicError ||
    qubicTotal === null;
  const assetDisabled =
    !detail ||
    hasPending ||
    sending ||
    !selectedOption ||
    !fees ||
    managedBalance === null ||
    rawAssetAmount === null ||
    !!assetError ||
    (assetAction === "grant" && grantAmount === null);

  const invalidateVault = async (vault: bigint) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.msvaultVault(apiIdentity, vault.toString()) }),
      queryClient.invalidateQueries({ queryKey: qk.msvaultVaults(apiIdentity, identity) }),
    ]);
  };

  async function submitQubicDeposit() {
    if (!detail || !fees || qubicAmount === null || qubicTotal === null || !tickInfo || !identity) return;
    if (walletBalance !== null && qubicTotal > walletBalance) {
      setError("Insufficient balance after the deposit fee.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload = MSVAULT.encodeProcedure("deposit", { vaultId: detail.id });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: MSVAULT_ADDRESS,
        inputType: MSVAULT_DEPOSIT_INPUT_TYPE,
        payload,
        amount: qubicTotal,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: MSVAULT_ADDRESS,
        amount: qubicTotal.toString(),
        targetTick,
        broadcastAt: Date.now(),
        contractName: "MSVault · Deposit",
      });

      await invalidateVault(detail.id);
      navigate(`/multisig/${rawId}`);
    } catch (submitError) {
      setError(extractMessage(submitError, "Broadcast failed."));
    } finally {
      setSending(false);
    }
  }

  async function submitAssetDeposit() {
    if (!detail || !fees || !selectedOption || rawAssetAmount === null || !tickInfo || !identity) return;
    setSending(true);
    setError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload = MSVAULT.encodeProcedure("depositAsset", {
        vaultId: detail.id,
        asset: {
          issuer: selectedOption.asset.issuer,
          assetName: selectedOption.asset.assetName,
        },
        amount: rawAssetAmount,
      });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: MSVAULT_ADDRESS,
        inputType: MSVAULT_DEPOSIT_ASSET_INPUT_TYPE,
        payload,
        amount: fees.depositFee,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: MSVAULT_ADDRESS,
        amount: fees.depositFee.toString(),
        targetTick,
        broadcastAt: Date.now(),
        contractName: "MSVault · Deposit asset",
      });

      await Promise.all([
        invalidateVault(detail.id),
        queryClient.invalidateQueries({
          queryKey: qk.msvaultManagedAsset(apiIdentity, identity, selectedOption.key),
        }),
      ]);
      navigate(`/multisig/${rawId}`);
    } catch (submitError) {
      setError(extractMessage(submitError, "Broadcast failed."));
    } finally {
      setSending(false);
    }
  }

  async function submitGrant() {
    if (!selectedOption || grantAmount === null || grantAmount <= 0n || !tickInfo || !identity) return;
    setAccessSending(true);
    setAccessError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload = QX.encodeProcedure("TransferShareManagementRights", {
        asset: {
          issuer: selectedOption.asset.issuer,
          assetName: selectedOption.asset.assetName,
        },
        numberOfShares: grantAmount,
        newManagingContractIndex: MSVAULT_CONTRACT_INDEX,
      });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: QX_ADDRESS,
        inputType: QX_TRANSFER_SHARE_MANAGEMENT_RIGHTS_INPUT_TYPE,
        payload,
        amount: 0n,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: QX_ADDRESS,
        amount: "0",
        targetTick,
        broadcastAt: Date.now(),
        contractName: "QX · Multisig access",
      });

      await queryClient.invalidateQueries({
        queryKey: qk.msvaultManagedAsset(apiIdentity, identity, selectedOption.key),
      });
      setAccessMode(null);
      setNotice("Access grant submitted. Deposit unlocks after the network confirms it.");
    } catch (submitError) {
      setAccessError(extractMessage(submitError, "Broadcast failed."));
    } finally {
      setAccessSending(false);
    }
  }

  async function submitRevoke() {
    if (!selectedOption || managedBalance === null || managedBalance <= 0n || !tickInfo || !identity) return;
    setAccessSending(true);
    setAccessError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick, settings.tickOffset);
      const payload = MSVAULT.encodeProcedure("revokeAssetManagementRights", {
        asset: {
          issuer: selectedOption.asset.issuer,
          assetName: selectedOption.asset.assetName,
        },
        numberOfShares: managedBalance,
      });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: MSVAULT_ADDRESS,
        inputType: MSVAULT_REVOKE_ASSET_MANAGEMENT_RIGHTS_INPUT_TYPE,
        payload,
        amount: MSVAULT_REVOKE_FEE,
        targetTick,
        currentTick: tickInfo.tick,
      });

      await broadcastTx(encoded);

      addPendingTx({
        hash,
        source: identity,
        destination: MSVAULT_ADDRESS,
        amount: MSVAULT_REVOKE_FEE.toString(),
        targetTick,
        broadcastAt: Date.now(),
        contractName: "MSVault · Withdraw access",
      });

      await queryClient.invalidateQueries({
        queryKey: qk.msvaultManagedAsset(apiIdentity, identity, selectedOption.key),
      });
      setAccessMode(null);
      setNotice("Access withdrawal submitted.");
    } catch (submitError) {
      setAccessError(extractMessage(submitError, "Broadcast failed."));
    } finally {
      setAccessSending(false);
    }
  }

  function primaryAction() {
    if (mode === "qubic") {
      void submitQubicDeposit();
      return;
    }
    if (assetAction === "grant") {
      setAccessError("");
      setAccessMode("grant");
      return;
    }
    void submitAssetDeposit();
  }

  const primaryLabel =
    mode === "qubic"
      ? "Deposit QUBIC"
      : assetAction === "grant"
        ? "Grant access"
        : "Deposit asset";

  const footer = (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <Button
        onClick={primaryAction}
        loading={sending}
        disabled={mode === "qubic" ? qubicDisabled : assetDisabled}
      >
        {primaryLabel}
      </Button>
      {mode === "asset" && managedBalance !== null && managedBalance > 0n ? (
        <TextButton
          tone="muted"
          disabled={hasPending}
          onClick={() => {
            setAccessError("");
            setAccessMode("revoke");
          }}
        >
          Withdraw access
        </TextButton>
      ) : null}
    </div>
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
          description="Unpaid holding fees can close a vault. It can no longer accept deposits."
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

  const feeText = (value: bigint | null): ReactNode => {
    if (feesQuery.isLoading) return "Loading fees…";
    if (feesQuery.isError || value === null) return "Fees unavailable";
    return `${formatQu(value)} QU`;
  };

  const accessAmount =
    accessMode === "grant"
      ? (grantAmount ?? rawAssetAmount ?? 0n)
      : (managedBalance ?? 0n);

  if (accessMode && selectedOption) {
    const granting = accessMode === "grant";
    return (
      <MultisigFlowShell
        footer={(
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <Button
              onClick={() => {
                if (granting) void submitGrant();
                else void submitRevoke();
              }}
              loading={accessSending}
              disabled={accessSending}
              style={{ width: "100%" }}
            >
              {granting ? "Grant access" : "Withdraw access"}
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={accessSending}
              onClick={() => {
                setAccessMode(null);
                setAccessError("");
              }}
              style={{ width: "100%" }}
            >
              Back
            </Button>
          </div>
        )}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={SECTION_LABEL}>{granting ? "Asset access" : "Withdraw asset access"}</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-section)", color: "var(--color-text-primary)" }}>
              {granting ? "Grant management rights" : "Return management to QX"}
            </span>
            <span style={{ ...BODY_COPY, color: "var(--color-text-tertiary)" }}>
              {detail.name.trim() || "Unnamed vault"}
            </span>
          </div>

          <div className="corner-frame" style={CARD}>
            <FeeRow label="Asset" value={<AssetMetaLabel asset={selectedOption.asset} />} />
            <FeeRow label="Shares" value={<AssetMetaLabel asset={selectedOption.asset} amount={accessAmount} />} />
            <FeeRow label="Fee" value={granting ? "None" : `${formatQu(MSVAULT_REVOKE_FEE)} QU`} />
          </div>

          <p style={BODY_COPY}>
            {granting
              ? "This gives MSVAULT management rights over these shares, but does not deposit them yet. Deposit after the grant is confirmed."
              : "Management of these shares returns to QX. Only the shares listed here are withdrawn."}
          </p>
          {!granting ? (
            <p style={{ ...BODY_COPY, color: "var(--color-text-tertiary)" }}>
              The {formatQu(MSVAULT_REVOKE_FEE)} QU fee is paid by this account and is not refundable.
            </p>
          ) : null}
          {accessError ? <p role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>{accessError}</p> : null}
        </div>
      </MultisigFlowShell>
    );
  }

  const accountFee =
    mode === "asset" && assetAction === "grant" ? 0n : depositFee;
  const accountTotal = mode === "qubic" ? qubicTotal : accountFee;
  const accountFeeLabel =
    accountFee === 0n ? "None" : feeText(accountFee);

  return (
    <MultisigFlowShell footer={footer}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <MultisigAccountSelect
          wallet={wallet}
          accounts={sessionAccounts}
          activeIndex={settings.activeAccountIndex}
          onSelect={setActiveAccountIndex}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={SECTION_LABEL}>Deposit to</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap", minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-section)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
              {detail.name.trim() || "Unnamed vault"}
            </span>
            <VaultId id={detail.id} />
          </span>
        </div>

        {notice ? <Notice>{notice}</Notice> : null}

        <ChoiceChips
          label="Deposit type"
          options={[
            { value: "qubic", label: "QUBIC" },
            { value: "asset", label: "Asset" },
          ]}
          selected={mode}
          onSelect={(value) => {
            setMode(value);
            setError("");
          }}
          disabled={sending}
        />

        {mode === "qubic" ? (
          <Section title="Amount">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <Input
                label="Amount"
                inputMode="numeric"
                autoComplete="off"
                value={amountText}
                disabled={sending}
                onChange={(event) => {
                  setAmountText(event.target.value.replace(/[^\d]/g, ""));
                  setError("");
                }}
                placeholder="0"
                error={qubicError || undefined}
              />
              <p style={BODY_COPY}>
                Wallet balance: {walletBalance !== null ? `${formatQu(walletBalance)} QU` : "—"}
              </p>
            </div>
          </Section>
        ) : (
          <>
            {assetOptions.length === 0 ? (
              <EmptyCollectionState
                title="No depositable assets"
                description="Assets managed by QX or MSVAULT appear here."
                icon="apps"
              />
            ) : (
              <>
                <DropdownSelect
                  id="deposit-asset"
                  label="Asset"
                  value={selectedOption?.key ?? ""}
                  options={assetOptions.map((option) => ({
                    value: option.key,
                    label: option.asset.name,
                  }))}
                  onChange={(value) => {
                    setAssetKey(value);
                    setError("");
                    setNotice("");
                  }}
                  disabled={sending}
                />

                {selectedOption ? (
                  <div className="corner-frame" style={CARD}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={SECTION_LABEL}>Available in wallet</span>
                      <span style={{ ...MONO_META, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {formatAssetAmount(selectedOption.shares, assetDecimals)}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={SECTION_LABEL}>Ready for vault</span>
                      <span style={{ ...MONO_META, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                        {managedQuery.isLoading
                          ? "Loading…"
                          : managedBalance !== null
                            ? formatAssetAmount(managedBalance, assetDecimals)
                            : "Unavailable"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <span style={SECTION_LABEL}>Asset decimals</span>
                      <span style={MONO_META}>
                        {assetDecimals}
                        {metaQuery.data?.unit ? ` · ${metaQuery.data.unit}` : ""}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <Input
                    label="Amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={assetAmount}
                    disabled={sending}
                    onChange={(event) => {
                      setAssetAmount(event.target.value.replace(/[^0-9.]/g, ""));
                      setError("");
                    }}
                    placeholder="0"
                    error={assetError || undefined}
                  />
                  {managedBalance !== null && managedBalance > 0n ? (
                    <p style={BODY_COPY}>
                      {formatAssetAmount(managedBalance, assetDecimals)} shares granted but not deposited.
                    </p>
                  ) : null}
                  {assetAction === "grant" && grantAmount !== null && grantAmount > 0n ? (
                    <p style={BODY_COPY}>
                      MSVAULT needs management rights before it can move these shares. This transaction grants
                      rights only; you will deposit after it confirms.
                    </p>
                  ) : null}
                </div>
              </>
            )}
            {excludedCount > 0 ? (
              <p style={BODY_COPY}>
                Some assets are managed by other contracts and cannot be deposited here.
              </p>
            ) : null}
          </>
        )}

        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <h2 style={SECTION_LABEL}>Fees</h2>
          {mode === "qubic" ? (
            <>
              <FeeRow label="Deposit fee" value={feeText(depositFee)} />
              <FeeRow
                label="Total from account"
                value={
                  qubicTotal !== null && fees
                    ? `${formatQu(qubicTotal)} QU`
                    : feesQuery.isLoading
                      ? "Loading fees…"
                      : "Fees unavailable"
                }
              />
            </>
          ) : (
            <>
              <FeeRow label="Deposit fee" value={feeText(depositFee)} />
              <FeeRow label="Grant fee" value="None" />
              <FeeRow label="Withdraw access fee" value={`${formatQu(MSVAULT_REVOKE_FEE)} QU`} />
            </>
          )}
          {feesQuery.isError ? (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <span role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>Fees unavailable</span>
              <TextButton onClick={() => void feesQuery.refetch()}>Retry</TextButton>
            </div>
          ) : null}
          <p style={BODY_COPY}>
            The vault must keep enough QUBIC to pay its holding fee. A vault that cannot pay closes.
          </p>
        </section>

        <ApprovalDisclosure label="Review">
          <ApprovalField label="Vault">
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)" }}>
              {detail.name.trim() || "Unnamed vault"}
            </span>
            <VaultId id={detail.id} />
          </ApprovalField>
          <ApprovalField label="Amount">
            {mode === "qubic" ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", fontVariantNumeric: "tabular-nums" }}>
                {qubicAmount !== null ? `${formatQu(qubicAmount)} QU` : "—"}
              </span>
            ) : selectedOption && rawAssetAmount !== null ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)" }}>
                <AssetMetaLabel asset={selectedOption.asset} amount={rawAssetAmount} />
              </span>
            ) : (
              <span style={MONO_META}>—</span>
            )}
          </ApprovalField>
          <ApprovalField label="Fee">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)" }}>
              {accountFeeLabel}
            </span>
          </ApprovalField>
          <ApprovalField label="Total from account">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", fontVariantNumeric: "tabular-nums" }}>
              {accountTotal !== null ? `${formatQu(accountTotal)} QU` : feeText(null)}
            </span>
          </ApprovalField>
          <ApprovalField label="Remaining wallet balance">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", fontVariantNumeric: "tabular-nums" }}>
              {walletBalance !== null && accountTotal !== null
                ? `${formatQu(walletBalance - accountTotal)} QU`
                : "—"}
            </span>
          </ApprovalField>
          <ApprovalField label="Holding fee per epoch">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-body-compact)", fontVariantNumeric: "tabular-nums" }}>
              {fees ? `${formatQu(fees.holdingFee)} QU` : feeText(null)}
            </span>
          </ApprovalField>
        </ApprovalDisclosure>

        {error ? (
          <p role="alert" style={{ ...BODY_COPY, color: "var(--color-status-error)" }}>{error}</p>
        ) : null}

        {hasPending ? (
          <p style={BODY_COPY}>Wait for your pending transaction to confirm before starting another.</p>
        ) : null}
      </div>

    </MultisigFlowShell>
  );
}
