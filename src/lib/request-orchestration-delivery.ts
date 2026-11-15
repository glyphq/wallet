import { buildSignedCallbackEnvelope } from "@/lib/callback-envelope";
import { signCallbackMessageFromSession } from "@/lib/secure-session";
import type { GlyphCallbackResponse, GlyphEnvelope } from "@/lib/request-schema";
import type {
  CallbackStatus,
  RequestOrchestrationDeps,
} from "./request-orchestration-types";

function nowEpochSeconds(deps: Pick<RequestOrchestrationDeps, "now">) {
  return Math.floor(deps.now() / 1000);
}

function resolveCallbackSigner(
  deps: Pick<RequestOrchestrationDeps, "signCallbackMessage">
) {
  return deps.signCallbackMessage ?? ((accountIndex: number, messageBytes: Uint8Array, result: GlyphCallbackResponse) =>
    signCallbackMessageFromSession(accountIndex, messageBytes, undefined, result));
}

function encodeCallbackResult(body: string) {
  return btoa(body).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function buildRedirectUrl(redirectUri: string, callbackBody: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("result", encodeCallbackResult(callbackBody));
  return url.toString();
}

export async function buildSignedCallbackBody(
  deps: RequestOrchestrationDeps,
  input: {
    envelope: GlyphEnvelope;
    result: GlyphCallbackResponse;
    identity: string;
    accountIndex: number;
  }
): Promise<string> {
  return JSON.stringify(await buildSignedCallbackEnvelope({
    envelope: input.envelope,
    result: input.result,
    identity: input.identity,
    accountIndex: input.accountIndex,
    signCallbackMessage: resolveCallbackSigner(deps),
    networkId: deps.callbackNetworkId,
    nowEpochSeconds: () => nowEpochSeconds(deps),
  }));
}

export async function deliverRequestResult(
  deps: RequestOrchestrationDeps,
  input: {
    callbackBody: string;
    callbackUrl: string | null;
    redirectUri: string | null;
    requestHistoryId: string | null;
  },
): Promise<CallbackStatus> {
  let callbackStatus: CallbackStatus = "ok";

  if (input.callbackUrl) {
    try {
      await deps.postCallback(input.callbackUrl, input.callbackBody);
      callbackStatus = "ok";
      if (input.requestHistoryId) {
        deps.updateRequestHistoryItem(input.requestHistoryId, {
          callbackStatus: "ok",
          callbackUpdatedAt: deps.now(),
        });
      }
    } catch {
      callbackStatus = "failed";
      if (input.requestHistoryId) {
        deps.updateRequestHistoryItem(input.requestHistoryId, {
          callbackStatus: "failed",
          callbackUpdatedAt: deps.now(),
        });
      }
      deps.recordAuditEvent({
        kind: "request_callback_failed",
        status: "failure",
        title: "Callback failed",
        detail: input.callbackUrl,
      });
    }
  }

  if (input.redirectUri) {
    await deps.openUrl(buildRedirectUrl(input.redirectUri, input.callbackBody)).catch(() => {});
  }

  return callbackStatus;
}
