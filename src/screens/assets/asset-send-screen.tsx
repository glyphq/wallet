import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRightUp, Bolt, CheckCircle, ClockCircle, UserId, Wallet } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Divider } from "@/components/divider";
import { Input } from "@/components/input";
import { AddressSuggestions } from "@/components/address-suggestions";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useBalance } from "@/hooks/use-balance";
import { useOwnedAssets } from "@/hooks/use-owned-assets";
import { useTxHistory } from "@/hooks/use-tx-history";
import { useRpcCacheIdentity } from "@/hooks/use-rpc-cache-identity";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { buildAddressSuggestions, getRecentRecipientIdentities } from "@/lib/address-intelligence";
import { buildQxAssetTransferCall, formatAssetUnits, validateQxAssetTransfer } from "@/lib/asset-transfer";
import { broadcastTx } from "@/lib/broadcast";
import { QX_ADDRESS, QX_CONTRACT_INDEX, qxFees } from "@/lib/contracts";
import { extractMessage, formatQu, truncateId } from "@/lib/format";
import { getLatestTick, estimateTargetTick, getRpcClient } from "@/lib/rpc";
import { buildScTransactionFromSession } from "@/lib/secure-session";
import { stepMotion } from "@/lib/animations";

type Step = "input" | "review" | "sending" | "done" | "error";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};

const noticeStyle: React.CSSProperties = {
  borderLeft: "2px solid var(--color-status-warning)",
  padding: "var(--space-2) 0 var(--space-2) var(--space-3)",
  display: "flex",
  alignItems: "flex-start",
  gap: "var(--space-2)",
};

function assetQuery(asset: { name: string; issuerIdentity: string; issuanceIndex: number; managingContractIndex: number }) {
  const params = new URLSearchParams({
    name: asset.name,
    issuer: asset.issuerIdentity,
    issuanceIndex: String(asset.issuanceIndex),
    managingContractIndex: String(asset.managingContractIndex),
  });
  return `/assets/send?${params.toString()}`;
}

export default function AssetSendScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const contacts = usePersistedStore((s) => s.contacts);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const wallets = useSessionStore((s) => s.wallets);
  const wallet = wallets[settings.activeAccountIndex] ?? null;
  const identity = getVaultAccountIdentity(vault ?? null, settings.activeAccountIndex, wallets) ?? "";
  const accountName = vault?.accounts[settings.activeAccountIndex]?.name ?? `Account ${settings.activeAccountIndex + 1}`;
  const hasPendingTx = pendingTxs.some((tx) => tx.source === identity);

  const { data: ownedAssets, isLoading: assetsLoading } = useOwnedAssets(identity || null);
  const { data: quBalanceData } = useBalance(identity || null);
  const quBalance = quBalanceData?.balance ?? null;
  const rpcIdentity = useRpcCacheIdentity("live");
  const { data: feeResult } = useQuery({
    queryKey: ["qx-fees", rpcIdentity],
    queryFn: () => qxFees(getRpcClient().live),
    staleTime: 60_000,
  });
  const qxTransferFee = feeResult?.ok ? BigInt(feeResult.value.transferFee) : null;
  const { data: recentTxsData } = useTxHistory(identity || null);
  const recentRecipientIdentities = useMemo(
    () => getRecentRecipientIdentities(identity || null, recentTxsData?.pages[0]),
    [identity, recentTxsData],
  );

  const selectedAsset = useMemo(() => {
    if (!ownedAssets) return null;
    const name = searchParams.get("name");
    const issuer = searchParams.get("issuer");
    const issuanceIndex = Number(searchParams.get("issuanceIndex"));
    const managingContractIndex = Number(searchParams.get("managingContractIndex"));
    return ownedAssets.find((asset) => (
      asset.name === name &&
      asset.issuerIdentity === issuer &&
      asset.issuanceIndex === issuanceIndex &&
      asset.managingContractIndex === managingContractIndex
    )) ?? null;
  }, [ownedAssets, searchParams]);

  const qxAssets = (ownedAssets ?? []).filter((asset) => asset.managingContractIndex === QX_CONTRACT_INDEX);
  const vaultAccountTargets = (vault?.accounts ?? [])
    .filter((a) => !a.hidden)
    .map((a) => ({ name: a.name, identity: a.identity ?? wallets[a.index]?.identity ?? "", note: a.note, tags: a.tags }))
    .filter((a) => a.identity && a.identity !== identity);

  const [step, setStep] = useState<Step>("input");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientError, setRecipientError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [formError, setFormError] = useState("");
  const [focusRecipient, setFocusRecipient] = useState(false);
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [savedTargetTick, setSavedTargetTick] = useState(0);

  const suggestions = useMemo(() => buildAddressSuggestions({
    query: recipient,
    contacts,
    accounts: vaultAccountTargets,
    currentIdentity: identity,
    recentIdentities: recentRecipientIdentities,
  }), [contacts, identity, recipient, recentRecipientIdentities, vaultAccountTargets]);

  const validation = selectedAsset ? validateQxAssetTransfer({
    asset: selectedAsset,
    sourceIdentity: identity,
    recipientIdentity: recipient,
    amountText: amount,
    qxTransferFee,
    quBalance,
  }) : null;

  function goReview() {
    if (!selectedAsset || !validation) return;
    setRecipientError(validation.recipientError);
    setAmountError(validation.amountError);
    setFormError(validation.formError);
    if (validation.ok) setStep("review");
  }

  async function send() {
    if (!wallet || !identity || !selectedAsset || !validation?.ok || qxTransferFee === null) return;
    setSending(true);
    setStep("sending");
    try {
      const currentTick = await getLatestTick();
      const targetTick = estimateTargetTick(currentTick, settings.tickOffset);
      const { inputType, payload } = buildQxAssetTransferCall({
        asset: selectedAsset,
        recipientIdentity: recipient,
        units: validation.units,
      });
      const { encoded, hash } = await buildScTransactionFromSession({
        accountIndex: settings.activeAccountIndex,
        destination: QX_ADDRESS,
        inputType,
        payload,
        amount: qxTransferFee,
        targetTick,
        currentTick,
      });
      await broadcastTx(encoded);

      const id = recipient.trim().toUpperCase();
      const contact = contacts.find((c) => c.identity === id);
      if (contact) updateContact(contact.id, { lastUsedAt: Date.now() });
      addPendingTx({
        hash,
        source: identity,
        destination: QX_ADDRESS,
        amount: qxTransferFee.toString(),
        targetTick,
        broadcastAt: Date.now(),
        contractName: `QX · Transfer ${selectedAsset.name}`,
      });
      setSavedTargetTick(targetTick);
      setTxHash(hash);
      setStep("done");
    } catch (e) {
      setTxError(extractMessage(e, "Broadcast failed."));
      setStep("error");
    } finally {
      setSending(false);
    }
  }

  if (!selectedAsset) {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", color: "var(--color-text-display)" }}>Send asset</h1>
            <p style={{ margin: "var(--space-1) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
              Select a live QX-managed asset owned by {accountName}.
            </p>
          </div>
          <Divider />
          {assetsLoading ? (
            <div className="skeleton" style={{ height: 64, borderRadius: "var(--radius-card)" }} />
          ) : qxAssets.length > 0 ? qxAssets.map((asset, index) => (
            <div key={`${asset.issuerIdentity}-${asset.name}-${asset.issuanceIndex}`}>
              {index > 0 && <Divider />}
              <button
                type="button"
                onClick={() => navigate(assetQuery(asset), { replace: true })}
                style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", width: "100%", background: "transparent", border: "none", cursor: "pointer", padding: "var(--space-3) 0", textAlign: "left" }}
              >
                <span style={{ color: "var(--color-accent)", display: "flex" }}><ArrowRightUp size={18} weight="Linear" /></span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>{asset.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{truncateId(asset.issuerIdentity)}</span>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-primary)" }}>{settings.hideBalances ? "•••" : formatAssetUnits(asset.numberOfUnits, asset.numberOfDecimalPlaces)}</span>
              </button>
            </div>
          )) : (
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>No transferable QX-managed owned assets found.</p>
          )}
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
        </div>
      </AppShell>
    );
  }

  const enteredUnits = validation?.units ?? 0n;
  const matchedContact = contacts.find((c) => c.identity === recipient.trim().toUpperCase());
  const showSuggestions = focusRecipient && recipient.trim() && suggestions.filter((s) => s.identity !== recipient.trim().toUpperCase()).length > 0;

  if (step === "input") {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>QX asset transfer</span>
            <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", color: "var(--color-text-display)" }}>Send {selectedAsset.name}</h1>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{settings.hideBalances ? "•••" : formatAssetUnits(selectedAsset.numberOfUnits, selectedAsset.numberOfDecimalPlaces)} available</span>
          </div>

          <div style={{ position: "relative" }}>
            <Input
              label="Recipient"
              value={recipient}
              onChange={(e) => { setRecipient(e.target.value); setRecipientError(""); setFormError(""); }}
              onFocus={() => setFocusRecipient(true)}
              onBlur={() => setTimeout(() => setFocusRecipient(false), 150)}
              onKeyDown={(e) => e.key === "Enter" && goReview()}
              placeholder="Identity or contact"
              technical
              error={recipientError}
              leftElement={<UserId size={16} />}
            />
            {matchedContact && !recipientError && (
              <span style={{ display: "inline-block", marginTop: "var(--space-1)", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-accent)" }}>{matchedContact.name}</span>
            )}
            {showSuggestions && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, marginTop: "var(--space-2)", padding: "var(--space-2)", background: "var(--color-bg-elevated)", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border-subtle)", boxShadow: "var(--shadow-overlay)", maxHeight: 220, overflowY: "auto" }}>
                <AddressSuggestions suggestions={suggestions.filter((s) => s.identity !== recipient.trim().toUpperCase())} onSelect={(id) => { setRecipient(id); setRecipientError(""); setFocusRecipient(false); }} />
              </div>
            )}
          </div>

          <Input
            label="Amount"
            value={amount}
            onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setAmountError(""); setFormError(""); }}
            onKeyDown={(e) => e.key === "Enter" && goReview()}
            placeholder="0"
            inputMode="decimal"
            technical
            error={amountError}
            rightElement={<span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", paddingRight: "var(--space-2)" }}>{selectedAsset.name}</span>}
          />

          <div style={{ borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <DetailRow icon={<Wallet size={16} />} label="From" value={accountName} mono={false} />
            <Divider />
            <DetailRow icon={<Bolt size={16} />} label="QX fee" value={qxTransferFee !== null ? `${formatQu(qxTransferFee)} QU` : "Loading…"} mono={false} />
          </div>

          {formError && (
            <div role="alert" style={{ ...noticeStyle, borderLeftColor: "var(--color-status-error)" }}>
              <ClockCircle size={16} style={{ flexShrink: 0, color: "var(--color-status-error)" }} />
              <span style={{ ...labelStyle, color: "var(--color-status-error)" }}>{formError}</span>
            </div>
          )}

          <div style={{ flex: 1 }} />
          <Button onClick={goReview} disabled={!wallet || !identity || qxTransferFee === null}>Review transfer</Button>
        </motion.div>
      </AppShell>
    );
  }

  if (step === "review") {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", color: "var(--color-text-display)" }}>Confirm asset send</h1>
            <p style={{ margin: "var(--space-1) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>QX will transfer ownership and possession to the recipient.</p>
          </div>
          <div style={{ borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <DetailRow icon={<ArrowRightUp size={16} />} label="Asset" value={selectedAsset.name} mono={false} />
            <Divider />
            <DetailRow icon={<Wallet size={16} />} label="Amount" value={`${formatAssetUnits(enteredUnits, selectedAsset.numberOfDecimalPlaces)} ${selectedAsset.name}`} mono={false} />
            <Divider />
            <DetailRow icon={<UserId size={16} />} label="Recipient" value={matchedContact?.name ?? truncateId(recipient.trim().toUpperCase())} mono={false} />
            <Divider />
            <DetailRow icon={<Bolt size={16} />} label="QX fee" value={qxTransferFee !== null ? `${formatQu(qxTransferFee)} QU` : "Loading…"} mono={false} />
          </div>
          {hasPendingTx && (
            <div role="status" style={noticeStyle}>
              <ClockCircle size={16} style={{ flexShrink: 0, color: "var(--color-status-warning)" }} />
              <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Transfer pending. Wait for confirmation before sending another transaction.</span>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
            <Button onClick={send} loading={sending} disabled={!wallet || hasPendingTx || qxTransferFee === null}>Sign and send</Button>
            <button type="button" onClick={() => setStep("input")} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center" }}>Edit</button>
          </div>
        </motion.div>
      </AppShell>
    );
  }

  if (step === "sending") {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
        <motion.div {...stepMotion} role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span aria-hidden="true" style={{ display: "inline-block", width: 18, height: 18, border: "2px solid var(--color-border-subtle)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
            <div>
              <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>Broadcasting QX transfer</h2>
              <p style={{ margin: "var(--space-1) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>{formatAssetUnits(enteredUnits, selectedAsset.numberOfDecimalPlaces)} {selectedAsset.name}</p>
            </div>
          </div>
          <Divider />
          <DetailRow icon={<Bolt size={16} />} label="Contract" value="QX · Transfer ownership and possession" mono={false} />
        </motion.div>
      </AppShell>
    );
  }

  if (step === "done") {
    return (
      <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <CheckCircle size={22} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
            <div>
              <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", color: "var(--color-text-display)" }}>Transfer pending</h1>
              <p style={{ margin: "var(--space-1) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>Broadcast accepted. Confirmation is tracked in activity.</p>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <DetailRow icon={<ArrowRightUp size={16} />} label="Sent" value={`${formatAssetUnits(enteredUnits, selectedAsset.numberOfDecimalPlaces)} ${selectedAsset.name}`} mono={false} />
            <Divider />
            <DetailRow icon={<ClockCircle size={16} />} label="Target tick" value={savedTargetTick ? savedTargetTick.toLocaleString() : "—"} mono={false} />
            <Divider />
            <DetailRow icon={<Bolt size={16} />} label="Hash" value={truncateId(txHash)} />
          </div>
          <div style={{ flex: 1 }} />
          <Button onClick={() => navigate("/dashboard")}>Done</Button>
        </motion.div>
      </AppShell>
    );
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: "var(--space-4)" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", color: "var(--color-status-error)" }}>Transfer failed</h1>
        <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{txError}</p>
        <Button onClick={() => setStep("review")}>Try again</Button>
        <Button variant="secondary" onClick={() => setStep("input")}>Edit transfer</Button>
      </motion.div>
    </AppShell>
  );
}
