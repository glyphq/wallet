import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { Divider } from "@/components/divider";
import { usePersistedStore, type ScheduledTransfer } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { isValidIdentity, newId } from "@/lib/crypto";
import { truncateId, formatQu } from "@/lib/format";

function formatNextRun(ts: number): string {
  const now = Date.now();
  const diff = ts - now;
  if (diff <= 0) return "Due now";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `in ${days}d ${hours}h`;
  return `in ${hours}h`;
}

export default function ScheduledTransfersScreen() {
  const navigate = useNavigate();

  const scheduledTransfers = usePersistedStore((s) => s.scheduledTransfers);
  const addScheduledTransfer = usePersistedStore((s) => s.addScheduledTransfer);
  const updateScheduledTransfer = usePersistedStore((s) => s.updateScheduledTransfer);
  const removeScheduledTransfer = usePersistedStore((s) => s.removeScheduledTransfer);
  const wallets = useSessionStore((s) => s.wallets);

  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const [formLabel, setFormLabel] = useState("");
  const [formSource, setFormSource] = useState(() => wallets[0]?.identity ?? "");
  const [formDest, setFormDest] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formInterval, setFormInterval] = useState("7");
  const [formError, setFormError] = useState("");

  function openAdd() {
    setFormLabel(""); setFormDest(""); setFormAmount(""); setFormInterval("7");
    setFormSource(wallets[0]?.identity ?? ""); setFormError("");
    setAdding(true);
  }

  function doAdd() {
    if (!formLabel.trim()) { setFormError("Label required"); return; }
    if (!isValidIdentity(formDest.trim().toUpperCase())) { setFormError("Invalid destination identity"); return; }
    const amount = formAmount.trim();
    if (!amount || !/^\d+$/.test(amount) || BigInt(amount) <= 0n) { setFormError("Invalid amount"); return; }
    const days = parseInt(formInterval, 10);
    if (!days || days < 1) { setFormError("Interval must be at least 1 day"); return; }

    const now = Date.now();
    addScheduledTransfer({
      id: newId(),
      label: formLabel.trim(),
      sourceIdentity: formSource,
      destination: formDest.trim().toUpperCase(),
      amount,
      intervalDays: days,
      nextRunAt: now + days * 86_400_000,
      createdAt: now,
      enabled: true,
    });
    setAdding(false);
  }

  return (
    <AppShell
      statusBar={
        <ScreenHeader
          title="Scheduled transfers"
          onBack={() => navigate("/send")}
          action={
            <button
              type="button"
              onClick={openAdd}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0 }}
            >
              + NEW
            </button>
          }
        />
      }
      contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
    >
      {scheduledTransfers.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [NO SCHEDULED TRANSFERS]
        </div>
      )}

      {scheduledTransfers.map((transfer, i) => (
        <div key={transfer.id}>
          {i > 0 && <Divider style={{ marginBottom: "var(--space-4)" }} />}
          <TransferRow
            transfer={transfer}
            onToggle={() => updateScheduledTransfer(transfer.id, { enabled: !transfer.enabled })}
            onSendNow={() => navigate(`/send?to=${transfer.destination}&amount=${transfer.amount}`)}
            onRemove={() => setConfirmRemove(transfer.id)}
            confirmingRemove={confirmRemove === transfer.id}
            onConfirmRemove={() => { removeScheduledTransfer(transfer.id); setConfirmRemove(null); }}
            onCancelRemove={() => setConfirmRemove(null)}
          />
        </div>
      ))}

      {/* New transfer modal */}
      <Modal open={adding} onClose={() => setAdding(false)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
            New scheduled transfer
          </div>
          <Input label="Label" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="e.g. Weekly allowance" autoFocus />

          {wallets.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>FROM</div>
              {wallets.map((w) => (
                <button
                  key={w.identity}
                  type="button"
                  onClick={() => setFormSource(w.identity)}
                  style={{ background: "none", border: `1px solid ${formSource === w.identity ? "var(--color-accent)" : "var(--color-border-strong)"}`, borderRadius: "var(--radius-sharp)", cursor: "pointer", padding: "var(--space-2) var(--space-3)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: formSource === w.identity ? "var(--color-accent)" : "var(--color-text-secondary)", letterSpacing: "0.05em", textAlign: "left" }}
                >
                  {truncateId(w.identity)}
                </button>
              ))}
            </div>
          )}

          <Input label="Destination" value={formDest} onChange={(e) => setFormDest(e.target.value)} placeholder="60-character identity" />
          <Input label="Amount (QU)" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="e.g. 1000000" inputMode="numeric" />
          <Input label="Every N days" value={formInterval} onChange={(e) => setFormInterval(e.target.value)} placeholder="7" inputMode="numeric" />

          {formError && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
              {formError}
            </div>
          )}

          <Button onClick={doAdd} disabled={!formLabel.trim() || !formDest.trim() || !formAmount.trim()}>
            Schedule
          </Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}

interface TransferRowProps {
  transfer: ScheduledTransfer;
  onToggle: () => void;
  onSendNow: () => void;
  onRemove: () => void;
  confirmingRemove: boolean;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}

function TransferRow({ transfer, onToggle, onSendNow, onRemove, confirmingRemove, onConfirmRemove, onCancelRemove }: TransferRowProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: transfer.enabled ? "var(--color-text-display)" : "var(--color-text-disabled)" }}>
            {transfer.label}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
            {formatQu(BigInt(transfer.amount))} QU → {truncateId(transfer.destination)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            Every {transfer.intervalDays}d · {transfer.enabled ? formatNextRun(transfer.nextRunAt) : "PAUSED"}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: transfer.enabled ? "var(--color-status-success)" : "var(--color-text-disabled)", letterSpacing: "0.05em", padding: 0, flexShrink: 0 }}
        >
          {transfer.enabled ? "ON" : "OFF"}
        </button>
      </div>

      {confirmingRemove ? (
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="button" onClick={onConfirmRemove} style={{ background: "none", border: "1px solid var(--color-status-error)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em", padding: "var(--space-1) var(--space-3)" }}>
            REMOVE
          </button>
          <button type="button" onClick={onCancelRemove} style={{ background: "none", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: "var(--space-1) var(--space-3)" }}>
            CANCEL
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="button" onClick={onSendNow} style={{ background: "none", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sharp)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: "var(--space-1) var(--space-3)" }}>
            SEND NOW
          </button>
          <button type="button" onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em", padding: 0 }}>
            REMOVE
          </button>
        </div>
      )}
    </div>
  );
}
