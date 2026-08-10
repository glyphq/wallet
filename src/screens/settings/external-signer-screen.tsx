import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle, ShieldCheck } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Divider } from "@/components/divider";
import { Input } from "@/components/input";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { Textarea } from "@/components/textarea";
import { stepMotion } from "@/lib/animations";
import { broadcastTx } from "@/lib/broadcast";
import {
  createExternalSignerTransferRequest,
  EXTERNAL_SIGNER_SUPPORT,
  verifyExternalSignedTransaction,
} from "@/lib/external-signer";
import { formatQu, truncateId } from "@/lib/format";
import { usePersistedStore, type ExternalSignerRequest } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const textStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  lineHeight: "var(--leading-body)",
  color: "var(--color-text-secondary)",
};

function Dot() {
  return <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-accent)", display: "inline-block" }} />;
}

function SectionDivider({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-text-disabled)", letterSpacing: "0.08em" }}>
        {children}
      </span>
      <Divider style={{ flex: 1, margin: 0 }} />
    </div>
  );
}

function statusLabel(request: ExternalSignerRequest): string {
  if (request.status === "broadcasted") return "Broadcasted";
  if (request.status === "signed") return "Verified";
  return "Unsigned";
}

export default function ExternalSignerScreen() {
  const activeVault = usePersistedStore((s) => s.vaults.find((vault) => vault.id === s.settings.activeVaultId) ?? null);
  const activeAccountIndex = usePersistedStore((s) => s.settings.activeAccountIndex);
  const wallets = useSessionStore((s) => s.wallets);
  const requests = usePersistedStore((s) => s.externalSignerRequests);
  const addRequest = usePersistedStore((s) => s.addExternalSignerRequest);
  const updateRequest = usePersistedStore((s) => s.updateExternalSignerRequest);
  const addPendingTx = usePersistedStore((s) => s.addPendingTx);

  const activeIdentity = activeVault?.accounts.find((account) => account.index === activeAccountIndex)?.identity
    ?? wallets[activeAccountIndex]?.identity
    ?? "";
  const [sourceIdentity, setSourceIdentity] = useState(activeIdentity);
  const [destinationIdentity, setDestinationIdentity] = useState("");
  const [amount, setAmount] = useState("");
  const [targetTick, setTargetTick] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);
  const [signedInput, setSignedInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? requests[0] ?? null,
    [requests, selectedId]
  );

  function createRequest() {
    setError(null);
    setMessage(null);
    try {
      const request = createExternalSignerTransferRequest({ sourceIdentity, destinationIdentity, amount, targetTick });
      addRequest(request);
      setSelectedId(request.id);
      setSignedInput("");
      setMessage("Unsigned transaction ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build unsigned transaction.");
    }
  }

  async function copyUnsigned() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.unsignedTxBase64);
    setMessage("Unsigned transaction copied.");
  }

  function verifyImport() {
    if (!selected) return;
    setError(null);
    setMessage(null);
    try {
      const verified = verifyExternalSignedTransaction(selected, signedInput);
      updateRequest(selected.id, {
        status: "signed",
        signedTxBase64: verified.signedTxBase64,
        txHash: verified.txHash,
        signedAt: Date.now(),
      });
      setMessage("Signed transaction verified.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signed transaction could not be verified.");
    }
  }

  async function broadcastSelected() {
    if (!selected?.signedTxBase64 || selected.status === "broadcasted") return;
    setBroadcasting(true);
    setError(null);
    setMessage(null);
    try {
      await broadcastTx(selected.signedTxBase64);
      updateRequest(selected.id, { status: "broadcasted", broadcastAt: Date.now() });
      if (selected.txHash) {
        addPendingTx({
          hash: selected.txHash,
          source: selected.sourceIdentity,
          destination: selected.destinationIdentity,
          amount: selected.amount,
          targetTick: selected.targetTick,
          broadcastAt: Date.now(),
        });
      }
      setMessage("Transaction broadcasted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broadcast failed.");
    } finally {
      setBroadcasting(false);
    }
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <SettingsPageHeader title="External signer" />
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingTop: "var(--space-3)" }}>
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4)", background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <ShieldCheck size={18} weight="Linear" style={{ color: "var(--color-accent)" }} />
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
              Unsigned export, verified import
            </span>
          </div>
          <p style={{ ...textStyle, margin: 0 }}>
            {EXTERNAL_SIGNER_SUPPORT.reason} Review a transfer, export unsigned bytes, then import a matching signed transaction.
          </p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4)", background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)" }}>
          <Input label="Source identity" value={sourceIdentity} onChange={(event) => setSourceIdentity(event.currentTarget.value)} technical />
          <Input label="Destination identity" value={destinationIdentity} onChange={(event) => setDestinationIdentity(event.currentTarget.value)} technical />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <Input label="Amount" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} inputMode="numeric" technical />
            <Input label="Target tick" value={targetTick} onChange={(event) => setTargetTick(event.currentTarget.value)} inputMode="numeric" technical />
          </div>
          <Button variant="primary" size="lg" onClick={createRequest}>Create unsigned transfer</Button>
        </section>

        {requests.length ? (
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <SectionDivider>Requests</SectionDivider>
            {requests.slice(0, 5).map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => {
                  setSelectedId(request.id);
                  setSignedInput(request.signedTxBase64 ?? "");
                  setError(null);
                  setMessage(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  width: "100%",
                  padding: "var(--space-3) var(--space-4)",
                  background: request.id === selected?.id ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
                  border: "none",
                  borderRadius: "var(--radius-card)",
                  color: "var(--color-text-primary)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                  {truncateId(request.destinationIdentity)} · {formatQu(BigInt(request.amount))} QU
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: request.status === "broadcasted" ? "var(--color-status-success)" : "var(--color-text-tertiary)" }}>
                  {statusLabel(request)}
                </span>
              </button>
            ))}
          </section>
        ) : null}

        {selected ? (
          <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-4)", background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)" }}>
            <SectionDivider>Review</SectionDivider>
            <DetailRow icon={<Dot />} label="From" value={truncateId(selected.sourceIdentity)} />
            <DetailRow icon={<Dot />} label="To" value={truncateId(selected.destinationIdentity)} />
            <DetailRow icon={<Dot />} label="Amount" value={`${formatQu(BigInt(selected.amount))} QU`} mono={false} />
            <DetailRow icon={<Dot />} label="Target tick" value={selected.targetTick.toString()} />
            <Textarea label="Unsigned transaction" value={selected.unsignedTxBase64} readOnly technical style={{ minHeight: 92 }} />
            <Button variant="secondary" size="md" onClick={copyUnsigned}>Copy unsigned</Button>
            <Textarea label="Signed transaction" value={signedInput} onChange={(event) => setSignedInput(event.currentTarget.value)} technical style={{ minHeight: 110 }} />
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Button variant="primary" size="md" onClick={verifyImport}>Verify import</Button>
              <Button variant="secondary" size="md" onClick={broadcastSelected} disabled={!selected.signedTxBase64 || selected.status === "broadcasted" || broadcasting} loading={broadcasting}>
                Broadcast signed
              </Button>
            </div>
            {selected.txHash ? <DetailRow icon={<CheckCircle size={16} weight="Linear" />} label="Hash" value={selected.txHash} /> : null}
          </section>
        ) : null}

        {message ? <p style={{ ...textStyle, color: "var(--color-status-success)", margin: 0 }}>{message}</p> : null}
        {error ? <p role="alert" style={{ ...textStyle, color: "var(--color-status-error)", margin: 0 }}>{error}</p> : null}
      </motion.div>
    </AppShell>
  );
}
