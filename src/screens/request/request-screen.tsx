import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { saveFileDialog } from "@/lib/save-file";
import { recordAuditEvent } from "@/lib/audit-log";
import { copyToClipboard } from "@/lib/clipboard";
import { openUrl } from "@tauri-apps/plugin-opener";
import { parseGlyphEnvelope } from "@/lib/request-schema";
import {
  approveRequest,
  deliverRequestResult,
  makeRequestHistoryId,
  rejectRequest,
  type RequestOrchestrationDeps,
  type RequestSuccessState,
} from "@/lib/request-orchestration";
import { completePendingRequest } from "@/lib/request-lifecycle";
import { authorizePendingRequest, signCallbackMessageFromSession, type SigningAuthorizationContext } from "@/lib/secure-session";
import type {
  ApproveResult,
  ConnectApproveResult,
  SignMessageApproveResult,
  VerifyMessageResult,
} from "@/lib/request-approvals";
import { Button } from "@/components/button";
import { StatusLine } from "./sheet-layout";
import { RequestApprovalView } from "./request-approval-view";
import { RequestTerminalView, type CopyStatus } from "./request-terminal-view";
import { useRequestExpiry } from "./use-request-expiry";

function successLabels(success: RequestSuccessState): { detailLabel: string; tagLabel: string; tone: "success" | "error" } {
  const detailLabel = success.kind === "tx" ? "Transaction hash" : success.kind === "message" ? "Signature" : success.kind === "verify" ? "Result" : "Address";
  const tagLabel = success.kind === "tx" ? "Sent" : success.kind === "message" ? "Signed" : success.kind === "verify" ? (success.detail === "VALID" ? "Valid" : "Invalid") : "Connected";
  return { detailLabel, tagLabel, tone: success.kind === "verify" && success.detail !== "VALID" ? "error" : "success" };
}

export default function RequestScreen() {
  const navigate = useNavigate();

  const pendingRequest = useSessionStore((s) => s.pendingRequests[0] ?? null);
  const pendingRequestCount = useSessionStore((s) => s.pendingRequests.length);
  const shiftPendingRequest = useSessionStore((s) => s.shiftPendingRequest);
  const wallets = usePersistedStore((s) => s.wallets);
  const networkName = usePersistedStore((s) => s.settings.network.name);
  const addRequestHistoryItem = usePersistedStore((s) => s.addRequestHistoryItem);
  const updateRequestHistoryItem = usePersistedStore((s) => s.updateRequestHistoryItem);

  const parseResult = parseGlyphEnvelope(pendingRequest);
  const envelope = parseResult.envelope;
  const parseError = parseResult.error;
  const [success, setSuccess] = useState<RequestSuccessState | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copyResetTimeoutRef = useRef<number | null>(null);
  const callbackPayloadRef = useRef<string | null>(null);
  const callbackAuthorizationRef = useRef<SigningAuthorizationContext | null>(null);
  const successRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingRequest && !success) navigate("/dashboard", { replace: true });
  }, [pendingRequest, success, navigate]);

  // A new request can arrive while the completion view is open. The active
  // queue head takes precedence so the wallet does not strand it behind a
  // stale success state.
  useEffect(() => {
    if (success && pendingRequest && pendingRequest !== successRequestRef.current) setSuccess(null);
  }, [pendingRequest, success]);

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

  const { expiredRequest, expirySecsLeft, clearExpiredRequest } = useRequestExpiry({
    envelope,
    suppressed: success !== null,
    addRequestHistoryItem,
  });

  const orchestrationDeps: RequestOrchestrationDeps = {
    now: Date.now,
    makeRequestHistoryId,
    postCallback: (url, body) => {
      const payload = callbackPayloadRef.current;
      if (!payload) return Promise.reject(new Error("callback request is no longer available"));
      return invoke("post_callback", { payload, url, body });
    },
    openUrl,
    addRequestHistoryItem,
    updateRequestHistoryItem,
    recordAuditEvent,
    signCallbackMessage: async (accountIndex, messageBytes, result) => {
      const authorization = callbackAuthorizationRef.current;
      if (!authorization) throw new Error("request approval authorization is unavailable");
      return signCallbackMessageFromSession(accountIndex, messageBytes, authorization, result);
    },
    callbackNetworkId: networkName === "mainnet" || networkName === "testnet" ? `qubic:${networkName}` : undefined,
  };

  const [actionError, setActionError] = useState<string | null>(null);

  function showSuccessIfQueueIsEmpty(state: RequestSuccessState) {
    // completePendingRequest shifts synchronously after a successful response.
    // When another request is already queued, render it immediately instead of
    // holding the screen on the previous request's completion view.
    if (useSessionStore.getState().pendingRequests.length === 0) {
      successRequestRef.current = pendingRequest;
      setSuccess(state);
    }
  }

  async function authorizeForRequest(accountIndex: number, intent: string): Promise<SigningAuthorizationContext> {
    if (!pendingRequest || !envelope) throw new Error("request is no longer available");
    const authorization = await authorizePendingRequest({
      payload: pendingRequest,
      dappOrigin: envelope.request.dapp.origin,
      requestHash: envelope.request_hash,
      accountIndex,
      intent,
    });
    const context = {
      authorization,
      requestPayload: pendingRequest,
      dappOrigin: envelope.request.dapp.origin,
    };
    callbackAuthorizationRef.current = context;
    return context;
  }

  async function reject() {
    if (!envelope) return;
    callbackPayloadRef.current = pendingRequest;
    setActionError(null);
    try {
      await authorizeForRequest(0, "callback:rejected");
      await completePendingRequest(() => rejectRequest(orchestrationDeps, envelope), shiftPendingRequest);
    } catch {
      setActionError("Could not prepare the rejection response. This request is still open. Try again.");
    }
  }

  async function handleApprove(result: ApproveResult, authorization: SigningAuthorizationContext) {
    if (!envelope) return;
    callbackPayloadRef.current = pendingRequest;
    callbackAuthorizationRef.current = authorization;
    setActionError(null);
    try {
      const state = await completePendingRequest(
        () => approveRequest(orchestrationDeps, { envelope, approval: { kind: "tx", approve: result }, wallets }),
        shiftPendingRequest,
      );
      showSuccessIfQueueIsEmpty(state);
    } catch {
      setActionError("Could not prepare the secure response. This request is still open. Try again.");
    }
  }

  async function handleApproveMessage(result: SignMessageApproveResult, authorization: SigningAuthorizationContext) {
    if (!envelope) return;
    callbackPayloadRef.current = pendingRequest;
    callbackAuthorizationRef.current = authorization;
    setActionError(null);
    try {
      const state = await completePendingRequest(
        () => approveRequest(orchestrationDeps, { envelope, approval: { kind: "message", approve: result }, wallets }),
        shiftPendingRequest,
      );
      showSuccessIfQueueIsEmpty(state);
    } catch {
      setActionError("Could not prepare the secure response. This request is still open. Try again.");
    }
  }

  async function handleApproveVerify(result: VerifyMessageResult) {
    if (!envelope) return;
    callbackPayloadRef.current = pendingRequest;
    setActionError(null);
    try {
      await authorizeForRequest(0, "callback:response");
      const state = await completePendingRequest(
        () => approveRequest(orchestrationDeps, { envelope, approval: { kind: "verify", approve: result }, wallets }),
        shiftPendingRequest,
      );
      showSuccessIfQueueIsEmpty(state);
    } catch {
      setActionError("Could not prepare the secure response. This request is still open. Try again.");
    }
  }

  async function handleApproveConnect(result: ConnectApproveResult) {
    if (!envelope) return;
    callbackPayloadRef.current = pendingRequest;
    setActionError(null);
    try {
      await authorizeForRequest(result.accountIndex, "callback:response");
      const state = await completePendingRequest(
        () => approveRequest(orchestrationDeps, { envelope, approval: { kind: "connect", approve: result }, wallets }),
        shiftPendingRequest,
      );
      showSuccessIfQueueIsEmpty(state);
    } catch {
      setActionError("Could not prepare the secure response. This request is still open. Try again.");
    }
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

  function continueAfterExpiry() {
    const hasQueuedRequest = useSessionStore.getState().pendingRequests.length > 1;
    clearExpiredRequest();
    shiftPendingRequest();
    if (!hasQueuedRequest) navigate("/dashboard", { replace: true });
  }

  if (success) {
    const labels = successLabels(success);
    const callbackAccessory = !success.hasCallback ? (
      <Button
        variant="secondary"
        shape="sharp"
        size="sm"
        style={{ width: "auto" }}
        onClick={() => copyResult(success.callbackBody)}
      >
        {copyStatus === "success" ? "Copied result" : copyStatus === "error" ? "Copy failed" : "Copy result"}
      </Button>
    ) : success.callbackStatus === "pending" ? (
      <StatusLine tone="muted">Sending callback...</StatusLine>
    ) : success.callbackStatus === "ok" ? (
      <StatusLine tone="success">Callback delivered</StatusLine>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <StatusLine tone="error">Callback failed</StatusLine>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <Button variant="secondary" shape="sharp" size="sm" style={{ width: "auto" }} onClick={retryCallbackFromSuccess}>
            Retry callback
          </Button>
          <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => saveResult(success)}>
            Save JSON
          </Button>
          <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => copyResult(success.callbackBody)}>
            {copyStatus === "success" ? "Copied JSON" : copyStatus === "error" ? "Copy failed" : "Copy JSON"}
          </Button>
        </div>
      </div>
    );

    return (
      <RequestTerminalView
        title="Request complete"
        tag={labels.tagLabel}
        tone={labels.tone}
        detailLabel={labels.detailLabel}
        detail={success.detail}
        accessory={callbackAccessory}
        primaryLabel="Return to app"
        onPrimary={() => navigate("/dashboard")}
      />
    );
  }

  if (expiredRequest) {
    return (
      <RequestTerminalView
        title="Request expired"
        tag="Expired"
        tone="warning"
        detailLabel="dApp"
        detail={expiredRequest.dappName}
        description="This request expired before you made a decision. Nothing was approved and no callback was sent. The outcome is saved in request history."
        primaryLabel="Continue"
        onPrimary={continueAfterExpiry}
      />
    );
  }

  if (!envelope) {
    return (
      <RequestTerminalView
        title="Request"
        tag="Invalid request"
        tone="error"
        description={parseError ?? "The request could not be read."}
        primaryLabel="Back to app"
        onPrimary={() => { shiftPendingRequest(); navigate("/dashboard"); }}
      />
    );
  }

  return (
    <RequestApprovalView
      request={envelope.request}
      pendingRequestCount={pendingRequestCount}
      actionError={actionError}
      expirySecsLeft={expirySecsLeft}
      onReject={reject}
      authorize={authorizeForRequest}
      onApprove={handleApprove}
      onApproveMessage={handleApproveMessage}
      onApproveVerify={handleApproveVerify}
      onApproveConnect={handleApproveConnect}
    />
  );
}
