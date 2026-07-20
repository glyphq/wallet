import { useEffect, useState, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/button";
import { useLockCountdown } from "@/hooks/use-lock-countdown";
import { Tag } from "@/components/tag";
import { RequestHeader } from "@/components/request/request-header";
import { TransferPreview, type ApproveResult } from "@/components/request/transfer-preview";
import { ScCallPreview } from "@/components/request/sc-call-preview";
import { SignMessagePreview, type SignMessageApproveResult } from "@/components/request/sign-message-preview";
import { ConnectPreview, type ConnectApproveResult } from "@/components/request/connect-preview";
import { VerifyMessagePreview, type VerifyMessageResult } from "@/components/request/verify-message-preview";
import { saveFileDialog } from "@/lib/save-file";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { ScreenHeader } from "@/components/screen-header";
import { recordAuditEvent } from "@/lib/audit-log";
import { copyToClipboard } from "@/lib/clipboard";
import { openUrl } from "@tauri-apps/plugin-opener";
import { parseGlyphEnvelope, REQUEST_TYPE_LABEL } from "@/lib/request-schema";
import {
  approveRequest,
  deliverRequestResult,
  makeRequestHistoryId,
  rejectRequest,
  type RequestOrchestrationDeps,
  type RequestSuccessState,
} from "@/lib/request-orchestration";

export default function RequestScreen() {
  const navigate = useNavigate();

  const pendingRequest = useSessionStore((s) => s.pendingRequests[0] ?? null);
  const pendingRequestCount = useSessionStore((s) => s.pendingRequests.length);
  const shiftPendingRequest = useSessionStore((s) => s.shiftPendingRequest);
  const vaults = usePersistedStore((s) => s.vaults);
  const approveDapp = usePersistedStore((s) => s.approveDapp);
  const addRequestHistoryItem = usePersistedStore((s) => s.addRequestHistoryItem);
  const updateRequestHistoryItem = usePersistedStore((s) => s.updateRequestHistoryItem);

  const parseResult = parseGlyphEnvelope(pendingRequest);
  const envelope = parseResult.envelope;
  const parseError = parseResult.error;
  const [success, setSuccess] = useState<RequestSuccessState | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [expirySecsLeft, setExpirySecsLeft] = useState<number | null>(null);
  const expiryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pendingRequest && !success) navigate("/dashboard", { replace: true });
  }, [pendingRequest, success, navigate]);

  useEffect(() => {
    setCopyStatus("idle");
    if (copyResetTimeoutRef.current !== null) {
      clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }
  }, [success?.callbackBody]);

  useEffect(() => () => {
    if (copyResetTimeoutRef.current !== null) {
      clearTimeout(copyResetTimeoutRef.current);
    }
  }, []);


  // Auto-dismiss when the request's exp timestamp passes so the approval
  // buttons don't remain active after expiry. Also drives a visible countdown.
  useEffect(() => {
    if (!envelope?.request.exp || success) {
      setExpirySecsLeft(null);
      return;
    }
    const msUntilExp = envelope.request.exp * 1000 - Date.now();
    if (msUntilExp <= 0) {
      shiftPendingRequest();
      return;
    }
    setExpirySecsLeft(Math.ceil(msUntilExp / 1000));
    const t = setTimeout(() => { shiftPendingRequest(); }, msUntilExp);
    expiryIntervalRef.current = setInterval(() => {
      const remaining = Math.ceil((envelope.request.exp! * 1000 - Date.now()) / 1000);
      setExpirySecsLeft(Math.max(0, remaining));
    }, 1000);
    return () => {
      clearTimeout(t);
      if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    };
  }, [envelope?.request.exp, success, shiftPendingRequest]);

  // Dismiss without notifying the dApp — used by the BACK button so navigating
  // away doesn't send a spurious rejection to the dApp.
  function dismiss() {
    shiftPendingRequest();
  }

  const orchestrationDeps: RequestOrchestrationDeps = {
    now: Date.now,
    makeRequestHistoryId,
    postCallback: (url, body) => invoke("post_callback", { url, body }),
    openUrl,
    addRequestHistoryItem,
    updateRequestHistoryItem,
    recordAuditEvent,
  };

  async function reject() {
    if (envelope) {
      void rejectRequest(orchestrationDeps, envelope);
    }
    shiftPendingRequest();
  }

  async function handleApprove(result: ApproveResult) {
    if (!envelope) return;
    shiftPendingRequest();
    const state = await approveRequest(orchestrationDeps, { envelope, approval: { kind: "tx", approve: result }, vaults });
    setSuccess(state);
  }

  async function handleApproveMessage(result: SignMessageApproveResult) {
    if (!envelope) return;
    shiftPendingRequest();
    const state = await approveRequest(orchestrationDeps, { envelope, approval: { kind: "message", approve: result }, vaults });
    setSuccess(state);
  }

  async function handleApproveVerify(result: VerifyMessageResult) {
    if (!envelope) return;
    shiftPendingRequest();
    const state = await approveRequest(orchestrationDeps, { envelope, approval: { kind: "verify", approve: result }, vaults });
    setSuccess(state);
  }

  async function handleApproveConnect(result: ConnectApproveResult) {
    if (!envelope) return;
    shiftPendingRequest();
    const state = await approveRequest(orchestrationDeps, { envelope, approval: { kind: "connect", approve: result }, vaults });
    approveDapp({
      origin: envelope.request.dapp.origin,
      name: envelope.request.dapp.name || "Unknown dApp",
      approvedAt: Date.now(),
      permissions: result.permissions,
      allowedIdentities: [result.identity],
    });
    setSuccess(state);
  }

  async function retryCallbackFromSuccess() {
    if (!success?.callbackUrl) return;
    setSuccess((current) => current ? { ...current, callbackStatus: "pending" } : current);
    const callbackStatus = await deliverRequestResult(orchestrationDeps, {
      callbackBody: success.callbackBody,
      callbackUrl: success.callbackUrl,
      redirectUri: null,
      requestHistoryId: success.requestHistoryId,
    });
    setSuccess((current) => current ? { ...current, callbackStatus } : current);
  }

  async function saveResult(successState: RequestSuccessState) {
    await saveFileDialog(`glyph-request-result-${Date.now()}.json`, successState.callbackBody);
  }

  async function copyResult(text: string) {
    const copied = await copyToClipboard(text);
    setCopyStatus(copied ? "success" : "error");
    if (copyResetTimeoutRef.current !== null) {
      clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyResetTimeoutRef.current = null;
    }, 1500);
  }

  // ── Success screen ──
  if (success) {
    const detailLabel = success.kind === "tx" ? "Transaction hash" : success.kind === "message" ? "Signature" : success.kind === "verify" ? "Result" : "Identity";
    const tagLabel = success.kind === "tx" ? "Sent" : success.kind === "message" ? "Signed" : success.kind === "verify" ? (success.detail === "VALID" ? "Valid" : "Invalid") : "Connected";

    return (
      <SheetLayout
        statusBar={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Request complete
            </span>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <Tag variant={success.kind === "verify" && success.detail !== "VALID" ? "error" : "success"}>{tagLabel}</Tag>
          </div>

          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
              {detailLabel}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-primary)", letterSpacing: "0.05em", wordBreak: "break-all" }}>
              {success.detail}
            </div>
          </div>

          <div>
            {!success.hasCallback ? (
              <Button
                variant="secondary"
                shape="sharp"
                size="sm"
                style={{ width: "auto" }}
                onClick={() => void copyResult(success.callbackBody)}
              >
                {copyStatus === "success" ? "Copied result" : copyStatus === "error" ? "Copy failed" : "Copy result"}
              </Button>
            ) : success.callbackStatus === "pending" ? (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
                Sending callback...
              </div>
            ) : success.callbackStatus === "ok" ? (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-success)" }}>
                Callback delivered
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-error)" }}>
                  Callback failed
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  <Button variant="secondary" shape="sharp" size="sm" style={{ width: "auto" }} onClick={retryCallbackFromSuccess}>
                    Retry callback
                  </Button>
                  <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => saveResult(success)}>
                    Save JSON
                  </Button>
                  <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => void copyResult(success.callbackBody)}>
                    {copyStatus === "success" ? "Copied JSON" : copyStatus === "error" ? "Copy failed" : "Copy JSON"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "auto", paddingTop: "var(--space-6)" }}>
            <Button onClick={() => navigate("/dashboard")} style={{ flex: 1 }}>Return to app</Button>
          </div>
        </div>
      </SheetLayout>
    );
  }

  if (!envelope) {
    return (
      <SheetLayout statusBar={<ScreenHeader title="Request" onBack={() => navigate("/dashboard")} />}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1, minHeight: "100%" }}>
          <Tag variant="error">Invalid request</Tag>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-error)" }}>
            {parseError}
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "auto", paddingTop: "var(--space-6)" }}>
            <Button variant="secondary" shape="sharp" onClick={() => { shiftPendingRequest(); navigate("/dashboard"); }} style={{ flex: 1 }}>Back to app</Button>
          </div>
        </div>
      </SheetLayout>
    );
  }

  const { request } = envelope;
  const typeLabel = REQUEST_TYPE_LABEL[request.type] ?? request.type;

  const statusBar = <ScreenHeader title={typeLabel} onBack={dismiss} backAriaLabel="Close without rejecting" />;

  return (
    <SheetLayout statusBar={statusBar} expirySecsLeft={expirySecsLeft}>
      <RequestHeader dapp={request.dapp} />
      {pendingRequestCount > 1 && (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-warning)" }}>
          {pendingRequestCount - 1} more request{pendingRequestCount > 2 ? "s" : ""} queued
        </div>
      )}

      {request.type === "transfer" ? (
        <TransferPreview
          request={request}
          onApprove={handleApprove}
          onReject={reject}
        />
      ) : request.type === "sc_call" ? (
        <ScCallPreview
          request={request}
          onApprove={handleApprove}
          onReject={reject}
        />
      ) : request.type === "sign_message" ? (
        <SignMessagePreview
          request={request}
          onApprove={handleApproveMessage}
          onReject={reject}
        />
      ) : request.type === "verify_message" ? (
        <VerifyMessagePreview
          request={request}
          onApprove={handleApproveVerify}
          onReject={reject}
        />
      ) : request.type === "connect" ? (
        <ConnectPreview
          request={request}
          onApprove={handleApproveConnect}
          onReject={reject}
        />
      ) : null}
    </SheetLayout>
  );
}

function SheetLayout({ statusBar, children, expirySecsLeft }: { statusBar: ReactNode; children: ReactNode; expirySecsLeft?: number | null }) {
  const countdown = useLockCountdown();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg-base)" }}>
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          minHeight: 48,
          padding: "var(--space-3) var(--screen-padding)",
        }}
      >
        {statusBar}
      </header>

      {countdown !== null && (
        <div
          aria-live="polite"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 var(--screen-padding) var(--space-2)",
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-warning)" }}>
            Locking in {countdown}s
          </span>
        </div>
      )}

      {expirySecsLeft !== null && expirySecsLeft !== undefined && (
        <div
          aria-live="polite"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 var(--screen-padding) var(--space-2)",
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: expirySecsLeft <= 10 ? "var(--color-status-error)" : "var(--color-text-disabled)" }}>
            Request expires in {expirySecsLeft}s
          </span>
        </div>
      )}

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "var(--space-2) var(--screen-padding) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
