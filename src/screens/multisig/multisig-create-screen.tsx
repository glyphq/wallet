import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/button";
import { ContactPicker, type PickerAccount } from "@/components/contact-picker";
import { DropdownSelect } from "@/components/dropdown-select";
import { FramedAvatar } from "@/components/framed-avatar";
import { IconButton } from "@/components/icon-button";
import { Input } from "@/components/input";
import { Tag } from "@/components/tag";
import { TextButton } from "@/components/text-button";
import { useApiCacheIdentity } from "@/hooks/use-api-cache-identity";
import { useBalance } from "@/hooks/use-balance";
import { useMsvaultFees } from "@/hooks/use-msvault";
import { useTickInfo } from "@/hooks/use-tick-info";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { estimateTargetTick } from "@/lib/api/network";
import { getMsvaultVaults } from "@/lib/api/msvault";
import { broadcastTx } from "@/lib/broadcast";
import { MSVAULT, MSVAULT_ADDRESS, MSVAULT_REGISTER_INPUT_TYPE } from "@/lib/contracts";
import { isValidIdentity } from "@/lib/crypto";
import { extractMessage, formatQu, truncateId } from "@/lib/format";
import {
  MSVAULT_MAX_OWNERS,
  defaultRequiredApprovals,
  encodeVaultName,
  validateMultisigConfig,
} from "@/lib/msvault";
import { qk } from "@/lib/query-keys";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { hasPendingFromAccount } from "@/screens/send/send-flow";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { AddCircleIcon, Delete02Icon, UserGroupIcon } from "@/lib/icons";
import {
  FeeRow,
  IdentityName,
  MultisigAccountSelect,
  MultisigFlowShell,
  identityDisplayName,
} from "./multisig-ui";

const MAX_NAME_BYTES = 32;
const MAX_VAULTS_PER_OWNER = 8;
const encoder = new TextEncoder();

const PAGE_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
  width: "min(100%, 640px)",
  margin: "0 auto",
  minWidth: 0,
} as const;

const SECTION_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  minWidth: 0,
} as const;

const LABEL_STYLE = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--leading-compact)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-tertiary)",
} as const;

const BODY_COPY = {
  margin: 0,
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body-compact)",
  lineHeight: "var(--leading-body)",
  color: "var(--color-text-secondary)",
} as const;

const CAPTION_COPY = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  lineHeight: "var(--leading-compact)",
  color: "var(--color-text-tertiary)",
  minWidth: 0,
  overflowWrap: "anywhere",
} as const;

const VALUE_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-mono-sm)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--color-text-primary)",
  textAlign: "right",
  minWidth: 0,
  overflowWrap: "anywhere",
} as const;

const OWNER_CARD_STYLE = {
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-3)",
  minWidth: 0,
  padding: "var(--space-3)",
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-sharp)",
} as const;

function ErrorBlock({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        padding: "var(--space-2) var(--space-3)",
        border: "1px solid var(--color-status-error)",
        borderRadius: "var(--radius-sharp)",
        background: "var(--color-status-error-soft)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-caption)",
        lineHeight: "var(--leading-body)",
        color: "var(--color-status-error)",
        overflowWrap: "anywhere",
      }}
    >
      {message}
    </div>
  );
}

export default function MultisigCreateScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apiIdentity = useApiCacheIdentity();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const contacts = usePersistedStore((s) => s.contacts);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const accounts = useSessionStore((s) => s.accounts);

  const wallet = wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const activeIndex = settings.activeAccountIndex;
  const identity = getWalletAccountIdentity(wallet, activeIndex, accounts);
  const activeUpper = identity?.trim().toUpperCase() ?? "";
  const activeAccountName =
    wallet?.accounts.find((account) => account.index === activeIndex)?.name.trim()
    || `Account ${activeIndex + 1}`;
  const pending = identity ? hasPendingFromAccount(pendingTxs, identity) : false;

  const feesQuery = useMsvaultFees();
  const fees = feesQuery.data ?? null;
  const feesError = feesQuery.isError;
  const { data: balanceData, isLoading: balanceLoading } = useBalance(identity);
  const balance = balanceData?.balance ?? null;
  const { data: tickInfo } = useTickInfo();

  const [step, setStep] = useState<"edit" | "review">("edit");
  const [name, setName] = useState("");
  const [extraOwners, setExtraOwners] = useState<string[]>([""]);
  const [ownerRowIds, setOwnerRowIds] = useState<number[]>([0]);
  const nextOwnerRowId = useRef(1);
  const [requiredApprovals, setRequiredApprovals] = useState(defaultRequiredApprovals(2));
  const [ownerErrors, setOwnerErrors] = useState<string[]>([""]);
  const [formError, setFormError] = useState("");
  const [preflightError, setPreflightError] = useState("");
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const ownerCount = 1 + extraOwners.length;
  const approvalsUpper = Math.max(2, ownerCount);
  const approvalsValue = Math.min(Math.max(requiredApprovals, 2), approvalsUpper);

  const pickerAccounts: PickerAccount[] = [];
  if (wallet) {
    for (const account of [...wallet.accounts].filter((item) => !item.hidden).sort((a, b) => a.index - b.index)) {
      if (account.index === activeIndex) continue;
      const accountIdentity = getWalletAccountIdentity(wallet, account.index, accounts);
      if (accountIdentity) pickerAccounts.push({ name: account.name, identity: accountIdentity });
    }
  }

  const normalizedOwners = [activeUpper, ...extraOwners.map((owner) => owner.trim().toUpperCase())];

  function validateForm(): boolean {
    setFormError("");
    setPreflightError("");
    setSubmitError("");
    let valid = true;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Vault name is required.");
      valid = false;
    } else if (encoder.encode(trimmedName).length > MAX_NAME_BYTES) {
      setFormError(`Vault name must be at most ${MAX_NAME_BYTES} bytes.`);
      valid = false;
    }

    if (!identity) {
      setFormError("No active account is available.");
      return false;
    }

    const nextOwnerErrors = extraOwners.map((raw, index) => {
      const value = raw.trim().toUpperCase();
      if (!value) return "Owner address is required.";
      if (!isValidIdentity(value)) return "Invalid address";
      if (value === activeUpper) return "Owner already added.";
      const duplicate = extraOwners.some(
        (other, otherIndex) => otherIndex !== index && other.trim().toUpperCase() === value,
      );
      return duplicate ? "Owner already added." : "";
    });
    setOwnerErrors(nextOwnerErrors);
    if (nextOwnerErrors.some(Boolean)) valid = false;

    if (valid) {
      const configError = validateMultisigConfig({
        name: trimmedName,
        owners: normalizedOwners,
        requiredApprovals: approvalsValue,
      });
      if (configError) {
        setFormError(configError);
        valid = false;
      }
    }

    return valid;
  }

  function handleNameChange(value: string) {
    setName(value);
    if (formError) setFormError("");
    if (preflightError) setPreflightError("");
  }

  function handleOwnerChange(index: number, value: string) {
    if (checking || sending) return;
    setExtraOwners((current) => current.map((owner, ownerIndex) => (ownerIndex === index ? value : owner)));
    setOwnerErrors((current) => current.map((error, ownerIndex) => (ownerIndex === index ? "" : error)));
    if (formError) setFormError("");
    setPreflightError("");
  }

  function addOwner() {
    if (checking || sending) return;
    if (ownerCount >= MSVAULT_MAX_OWNERS) return;
    const rowId = nextOwnerRowId.current++;
    setExtraOwners((current) => [...current, ""]);
    setOwnerRowIds((current) => [...current, rowId]);
    setOwnerErrors((current) => [...current, ""]);
    setRequiredApprovals(defaultRequiredApprovals(Math.max(2, ownerCount + 1)));
  }

  function removeOwner(index: number) {
    if (checking || sending) return;
    setExtraOwners((current) => current.filter((_, ownerIndex) => ownerIndex !== index));
    setOwnerRowIds((current) => current.filter((_, ownerIndex) => ownerIndex !== index));
    setOwnerErrors((current) => current.filter((_, ownerIndex) => ownerIndex !== index));
    setRequiredApprovals(defaultRequiredApprovals(Math.max(2, ownerCount - 1)));
    setPreflightError("");
  }

  function chooseOwner(value: string) {
    if (pickerIndex === null) return;
    handleOwnerChange(pickerIndex, value);
    setPickerIndex(null);
  }

  function selectAccount(index: number) {
    if (sending || checking) return;
    setActiveAccountIndex(index);
    setStep("edit");
    setFormError("");
    setPreflightError("");
    setSubmitError("");
    setOwnerErrors((current) => current.map(() => ""));
  }

  async function goReview() {
    if (!validateForm() || !identity || !fees) return;
    setChecking(true);
    try {
      const ownerVaults = await Promise.all(
        normalizedOwners.map((owner) => getMsvaultVaults(owner)),
      );
      const blockedIndex = ownerVaults.findIndex(
        (vaults) => new Set(vaults.map((vault) => vault.id.toString())).size >= MAX_VAULTS_PER_OWNER,
      );
      if (blockedIndex >= 0) {
        const owner = normalizedOwners[blockedIndex] ?? "";
        setPreflightError(
          `Owner ${identityDisplayName(owner, contacts, wallet, accounts)} already belongs to the maximum of ${MAX_VAULTS_PER_OWNER} multisig vaults.`,
        );
        return;
      }
      setStep("review");
    } catch (error) {
      setPreflightError(extractMessage(error, "Could not check owner vault limits. Try again."));
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    if (!identity || !fees || !tickInfo || sending || pending) return;
    setSending(true);
    setSubmitError("");
    try {
      const targetTick = estimateTargetTick(tickInfo.tick ?? 0, settings.tickOffset);
      const payload = MSVAULT.encodeProcedure("registerVault", {
        vaultName: encodeVaultName(name),
        owners: normalizedOwners,
        requiredApprovals: BigInt(approvalsValue),
      });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: activeIndex,
        destination: MSVAULT_ADDRESS,
        inputType: MSVAULT_REGISTER_INPUT_TYPE,
        payload,
        amount: fees.registeringFee,
        targetTick,
        currentTick: tickInfo.tick,
      });
      await broadcastTx(encoded);
      addPendingTx({
        hash,
        source: identity,
        destination: MSVAULT_ADDRESS,
        amount: fees.registeringFee.toString(),
        targetTick,
        broadcastAt: Date.now(),
        contractName: "MSVault · Create",
      });
      void queryClient.invalidateQueries({ queryKey: qk.msvaultVaults(apiIdentity, identity) });
      navigate("/multisig");
    } catch (error) {
      setSubmitError(extractMessage(error, "Could not create the multisig vault."));
    } finally {
      setSending(false);
    }
  }

  const insufficientBalance =
    !!fees && balance !== null && balance < fees.registeringFee;
  const canContinue =
    !!identity
    && !!fees
    && !feesError
    && !feesQuery.isLoading
    && balance !== null
    && !insufficientBalance
    && !pending
    && !checking;
  const canSubmit =
    !!identity
    && !!fees
    && !feesError
    && !!tickInfo
    && balance !== null
    && !insufficientBalance
    && !pending
    && !sending;

  let continueHint = "";
  if (pending) continueHint = "You have a pending transaction. Wait for it to confirm.";
  else if (feesQuery.isLoading) continueHint = "Loading fees…";
  else if (feesError) continueHint = "Fees unavailable";
  else if (balanceLoading) continueHint = "Loading balance…";
  else if (balance === null) continueHint = "Balance unavailable.";
  else if (insufficientBalance && fees) {
    continueHint = `Insufficient balance. The registration fee is ${formatQu(fees.registeringFee)} QU.`;
  }

  const footer = step === "edit" ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
      <Button onClick={() => void goReview()} loading={checking} disabled={!canContinue} style={{ width: "100%" }}>
        Continue
      </Button>
      {continueHint ? <span style={{ ...CAPTION_COPY, textAlign: "center" }}>{continueHint}</span> : null}
    </div>
  ) : (
    <div style={{ display: "flex", gap: "var(--space-2)", minWidth: 0 }}>
      <Button
        variant="secondary"
        size="md"
        style={{ flex: 1 }}
        disabled={sending}
        onClick={() => {
          setStep("edit");
          setSubmitError("");
        }}
      >
        Back
      </Button>
      <Button
        size="md"
        style={{ flex: 1 }}
        loading={sending}
        disabled={!canSubmit}
        onClick={() => void submit()}
      >
        Create vault
      </Button>
    </div>
  );

  return (
    <MultisigFlowShell footer={footer}>
      <div style={PAGE_STYLE}>
        <MultisigAccountSelect
          wallet={wallet}
          accounts={accounts}
          activeIndex={activeIndex}
          onSelect={selectAccount}
        />

        {step === "edit" ? (
          <>
            <p style={BODY_COPY}>Owners approve releases before the vault moves funds.</p>

            <section aria-label="Vault details" style={SECTION_STYLE}>
              <Input
                label="Vault name"
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Treasury"
                maxLength={MAX_NAME_BYTES}
                error={formError && (formError.startsWith("Vault name") || formError === "Vault name is required.") ? formError : undefined}
                autoComplete="off"
              />
            </section>

            <section aria-label="Owners" style={SECTION_STYLE}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-2)" }}>
                <p style={LABEL_STYLE}>Owners</p>
                <span style={CAPTION_COPY}>{ownerCount} of {MSVAULT_MAX_OWNERS}</span>
              </div>

              <div style={OWNER_CARD_STYLE}>
                <FramedAvatar seed={identity ?? activeAccountName} size={34} />
                <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)", minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--text-body-compact)",
                        fontWeight: 500,
                        color: "var(--color-text-primary)",
                        minWidth: 0,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {activeAccountName}
                    </span>
                    <Tag>You</Tag>
                  </span>
                  <span style={CAPTION_COPY}>{identity ?? "No active account"}</span>
                </div>
              </div>

              {extraOwners.map((owner, index) => {
                const ownerNumber = index + 2;
                return (
                  <div key={ownerRowIds[index]} style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)", minWidth: 0 }}>
                    <Input
                      containerStyle={{ flex: 1, minWidth: 0 }}
                      label={`Owner ${ownerNumber}`}
                      value={owner}
                      onChange={(event) => handleOwnerChange(index, event.target.value)}
                      placeholder="Identity address"
                      error={ownerErrors[index] || undefined}
                      autoComplete="off"
                      rightElement={(
                        <button
                          type="button"
                          onClick={() => setPickerIndex(index)}
                          aria-label={`Choose owner ${ownerNumber}`}
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
                      )}
                    />
                    <IconButton
                      label={`Remove owner ${ownerNumber}`}
                      onClick={() => removeOwner(index)}
                      style={{ marginBottom: 1, flexShrink: 0 }}
                    >
                      <Delete02Icon size={18} aria-hidden="true" />
                    </IconButton>
                  </div>
                );
              })}

              <div>
                <TextButton
                  onClick={addOwner}
                  disabled={ownerCount >= MSVAULT_MAX_OWNERS}
                  aria-label="Add owner"
                >
                  <AddCircleIcon size={14} strokeWidth={1.5} aria-hidden="true" />
                  Add owner
                </TextButton>
              </div>
            </section>

            <section aria-label="Approvals" style={SECTION_STYLE}>
              <DropdownSelect
                id="multisig-approvals"
                label="Approvals required"
                value={String(approvalsValue)}
                options={Array.from(
                  { length: approvalsUpper - 1 },
                  (_, index) => index + 2,
                ).map((count) => ({
                  value: String(count),
                  label: `${count} of ${Math.max(2, ownerCount)}`,
                }))}
                onChange={(value) => setRequiredApprovals(Number(value))}
              />
            </section>

            <section aria-label="Fees" style={SECTION_STYLE}>
              {feesError ? (
                <FeeRow
                  label="Fees"
                  value="Fees unavailable"
                  hint={(
                    <TextButton tone="danger" onClick={() => void feesQuery.refetch()}>
                      Retry
                    </TextButton>
                  )}
                />
              ) : (
                <>
                  <FeeRow
                    label="Registration fee"
                    value={fees ? `${formatQu(fees.registeringFee)} QU` : "Loading fees…"}
                  />
                  <FeeRow
                    label="Holding fee per epoch"
                    value={fees ? `${formatQu(fees.holdingFee)} QU` : "Loading fees…"}
                  />
                </>
              )}
            </section>

            <ErrorBlock message={formError && !formError.startsWith("Vault name") ? formError : ""} />
            <ErrorBlock message={preflightError} />
          </>
        ) : (
          <>
            <section aria-label="Vault review" style={SECTION_STYLE}>
              <p style={LABEL_STYLE}>Vault name</p>
              <span style={{ ...VALUE_STYLE, textAlign: "left", fontSize: "var(--text-body)" }}>
                {name.trim()}
              </span>
            </section>

            <section aria-label="Owners" style={SECTION_STYLE}>
              <p style={LABEL_STYLE}>Owners</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", minWidth: 0 }}>
                {normalizedOwners.map((owner) => (
                  <div
                    key={owner}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      minWidth: 0,
                      padding: "var(--space-2) 0",
                    }}
                  >
                    <FramedAvatar seed={owner} size={28} />
                    <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--text-body-compact)",
                          color: "var(--color-text-primary)",
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                      >
                        <IdentityName
                          identity={owner}
                          contacts={contacts}
                          wallet={wallet}
                          sessionAccounts={accounts}
                        />
                      </span>
                      <span style={CAPTION_COPY}>{truncateId(owner, 10, 10)}</span>
                    </span>
                    {owner === activeUpper ? <Tag>You</Tag> : null}
                  </div>
                ))}
              </div>
            </section>

            <section aria-label="Approvals" style={SECTION_STYLE}>
              <FeeRow label="Approvals" value={`${approvalsValue} of ${normalizedOwners.length} approvals`} />
            </section>

            <section aria-label="Fees" style={SECTION_STYLE}>
              {feesError ? (
                <FeeRow
                  label="Fees"
                  value="Fees unavailable"
                  hint={(
                    <TextButton tone="danger" onClick={() => void feesQuery.refetch()}>
                      Retry
                    </TextButton>
                  )}
                />
              ) : !fees ? (
                <>
                  <FeeRow label="Registration fee" value="Loading fees…" />
                  <FeeRow label="Holding fee per epoch" value="Loading fees…" />
                </>
              ) : (
                <>
                  <FeeRow label="Registration fee" value={`${formatQu(fees.registeringFee)} QU`} />
                  <FeeRow label="Holding fee per epoch" value={`${formatQu(fees.holdingFee)} QU`} />
                  <FeeRow label="Total from account" value={`${formatQu(fees.registeringFee)} QU`} />
                </>
              )}
            </section>

            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--color-status-warning)",
                borderRadius: "var(--radius-sharp)",
                background: "var(--color-status-warning-soft)",
              }}
            >
              <Tag variant="warning">Holding fee</Tag>
              <span
                style={{
                  flex: "1 1 160px",
                  minWidth: 0,
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-caption)",
                  lineHeight: "var(--leading-body)",
                  color: "var(--color-status-warning)",
                  overflowWrap: "anywhere",
                }}
              >
                A vault that cannot pay its holding fee closes, and its assets may become unrecoverable.
              </span>
            </div>

            {pending ? (
              <p style={CAPTION_COPY}>You have a pending transaction. Wait for it to confirm before creating another vault.</p>
            ) : null}
            {!tickInfo ? <p style={CAPTION_COPY}>Waiting for the network tick…</p> : null}

            <ErrorBlock message={submitError} />
            {submitError ? (
              <div>
                <TextButton tone="danger" onClick={() => void submit()}>
                  Retry
                </TextButton>
              </div>
            ) : null}
          </>
        )}
      </div>

      <ContactPicker
        open={pickerIndex !== null}
        onClose={() => setPickerIndex(null)}
        onSelect={chooseOwner}
        contacts={contacts}
        accounts={pickerAccounts}
        title="Choose owner"
      />
    </MultisigFlowShell>
  );
}
