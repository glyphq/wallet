import type { GlyphEnvelope } from "@/lib/request-schema";
import type { RequestHistoryItem, WalletMeta } from "@/store/persisted";
import type { RequestOrchestrationDeps } from "./request-orchestration-types";

export function makeRequestHistoryId() {
  return `req_${crypto.randomUUID()}`;
}

function getAccountNameForIdentity(wallets: WalletMeta[], identity: string) {
  for (const wallet of wallets) {
    const account = wallet.accounts.find((candidate) => candidate.identity === identity);
    if (account) return account.name;
  }
  return undefined;
}

export function addRejectedRequestHistory(
  deps: RequestOrchestrationDeps,
  input: {
    requestHistoryId: string;
    envelope: GlyphEnvelope;
    callbackBody: string;
  }
) {
  deps.addRequestHistoryItem({
    id: input.requestHistoryId,
    createdAt: deps.now(),
    type: input.envelope.request.type,
    dappName: input.envelope.request.dapp.name || "Unknown dApp",
    dappOrigin: input.envelope.request.dapp.origin,
    action: "rejected",
    callbackStatus: input.envelope.callback ? "pending" : "none",
    callbackUrl: input.envelope.callback,
    callbackBody: input.callbackBody,
    callbackUpdatedAt: input.envelope.callback ? deps.now() : null,
  });
}

export function addApprovedRequestHistory(
  deps: RequestOrchestrationDeps,
  input: {
    requestHistoryId: string;
    envelope: GlyphEnvelope;
    identity: string;
    callbackUrl: string | null;
    callbackBody: string;
    history: Pick<RequestHistoryItem, "resultKind" | "resultDetail">;
    wallets: WalletMeta[];
  }
) {
  deps.addRequestHistoryItem({
    id: input.requestHistoryId,
    createdAt: deps.now(),
    type: input.envelope.request.type,
    dappName: input.envelope.request.dapp.name || "Unknown dApp",
    dappOrigin: input.envelope.request.dapp.origin,
    action: "approved",
    accountIdentity: input.identity,
    accountName: getAccountNameForIdentity(input.wallets, input.identity),
    resultKind: input.history.resultKind,
    resultDetail: input.history.resultDetail,
    callbackStatus: input.callbackUrl ? "pending" : "none",
    callbackUrl: input.callbackUrl,
    callbackBody: input.callbackBody,
    callbackUpdatedAt: input.callbackUrl ? deps.now() : null,
  });
}
