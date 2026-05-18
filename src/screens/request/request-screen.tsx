import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Tag } from "@/components/tag";
import { Divider } from "@/components/divider";
import { RequestHeader } from "@/components/request/request-header";
import { TransferPreview, type ApproveResult } from "@/components/request/transfer-preview";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { useAutoLock } from "@/hooks/use-auto-lock";

interface SigilEnvelope {
  request: {
    type: "transfer" | "sc_call" | "sign_message" | "connect";
    dapp: { name: string; origin: string; icon?: string };
    nonce: string;
    exp?: number;
    [key: string]: unknown;
  };
  callback: string | null;
}

function parseEnvelope(raw: string | null): SigilEnvelope | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as SigilEnvelope;
    if (!env.request?.type || !env.request?.dapp?.origin) return null;
    return env;
  } catch {
    return null;
  }
}

const TYPE_LABEL: Record<string, string> = {
  transfer: "Send QU",
  sc_call: "Contract call",
  sign_message: "Sign message",
  connect: "Connect",
};

type CallbackStatus = "pending" | "ok" | "failed";

interface SuccessState {
  txHash: string;
  dappName: string;
  callbackStatus: CallbackStatus;
  callbackBody: string;
}

export default function RequestScreen() {
  const navigate = useNavigate();
  useAutoLock();

  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const pendingRequest = useSessionStore((s) => s.pendingRequest);
  const setPendingRequest = useSessionStore((s) => s.setPendingRequest);

  const envelope = parseEnvelope(pendingRequest);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  useEffect(() => {
    if (!envelope && !success) navigate("/dashboard", { replace: true });
  }, [envelope, success, navigate]);

  function reject() {
    // POST rejected callback if there's a callback URL
    if (envelope?.callback) {
      const body = JSON.stringify({
        status: "rejected",
        nonce: envelope.request.nonce,
        type: envelope.request.type,
        reason: "user_rejected",
      });
      invoke("post_callback", { url: envelope.callback, body }).catch(() => {});
    }
    setPendingRequest(null);
    navigate("/dashboard", { replace: true });
  }

  async function handleApprove({ txHash, targetTick, identity }: ApproveResult) {
    if (!envelope) return;

    const callbackBody = JSON.stringify({
      status: "signed",
      nonce: envelope.request.nonce,
      type: envelope.request.type,
      identity,
      tx_hash: txHash,
      target_tick: targetTick,
    });

    setPendingRequest(null);
    const state: SuccessState = {
      txHash,
      dappName: envelope.request.dapp.name,
      callbackStatus: "pending",
      callbackBody,
    };
    setSuccess(state);

    if (envelope.callback) {
      try {
        await invoke("post_callback", { url: envelope.callback, body: callbackBody });
        setSuccess((s) => s ? { ...s, callbackStatus: "ok" } : s);
      } catch {
        setSuccess((s) => s ? { ...s, callbackStatus: "failed" } : s);
      }
    } else {
      setSuccess((s) => s ? { ...s, callbackStatus: "ok" } : s);
    }
  }

  // ── Success screen ──
  if (success) {
    return (
      <AppShell
        statusBar={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {success.dappName}
            </span>
          </div>
        }
        contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
      >
        <div style={{ textAlign: "center" }}>
          <Tag variant="success">SENT</Tag>
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-2)" }}>
            Transaction hash
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
            {success.txHash}
          </div>
        </div>

        <div>
          {success.callbackStatus === "pending" && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
              [SENDING CALLBACK...]
            </div>
          )}
          {success.callbackStatus === "ok" && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-success)", letterSpacing: "0.05em" }}>
              [CALLBACK DELIVERED]
            </div>
          )}
          {success.callbackStatus === "failed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-error)", letterSpacing: "0.05em" }}>
                [CALLBACK FAILED]
              </div>
              <Button
                variant="secondary"
                shape="sharp"
                size="sm"
                style={{ width: "auto" }}
                onClick={() => navigator.clipboard.writeText(success.callbackBody).catch(() => {})}
              >
                Copy result
              </Button>
            </div>
          )}
        </div>

        <Button onClick={() => navigate("/dashboard")}>Return to app</Button>
      </AppShell>
    );
  }

  if (!envelope) return null;

  const { request } = envelope;
  const typeLabel = TYPE_LABEL[request.type] ?? request.type;

  const statusBar = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={reject}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0 }}
      >
        ← BACK
      </button>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {typeLabel}
      </span>
      <span style={{ width: 40 }} />
    </div>
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <RequestHeader dapp={request.dapp} approvedDapps={approvedDapps} />
      <Divider />

      {request.type === "transfer" ? (
        <TransferPreview
          request={request as unknown as Parameters<typeof TransferPreview>[0]["request"]}
          onApprove={handleApprove}
          onReject={reject}
        />
      ) : (
        <>
          <div style={{ textAlign: "center", padding: "var(--space-8) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            [{request.type.toUpperCase()} REQUEST]
          </div>
          <Button variant="danger" shape="sharp" onClick={reject}>Reject</Button>
        </>
      )}
    </AppShell>
  );
}
