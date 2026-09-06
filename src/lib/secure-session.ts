import { invoke } from "@tauri-apps/api/core";
import { deriveIdentityFromSeed, identityToPublicKey, publicKeyFromSeed } from "@/lib/crypto";
import type { Seed } from "@/lib/crypto";
import type { SessionWallet } from "@/lib/session-wallet";

interface BuildTxParams {
  accountIndex: number;
  destination: string;
  amount: bigint;
  targetTick: number;
  currentTick?: number;
  inputType: number;
  payload: Uint8Array;
}

export interface SignedTxResult {
  encoded: string;
  hash: string;
}

export interface SigningAuthorizationContext {
  authorization: string;
  requestPayload?: string;
  dappOrigin?: string;
}

export function transactionSigningIntent(input: {
  accountIndex: number;
  destination: string;
  amount: bigint;
  inputType: number;
  payload: Uint8Array;
}) {
  return JSON.stringify({
    kind: "transaction",
    accountIndex: input.accountIndex,
    destination: input.destination,
    amount: input.amount.toString(),
    inputType: input.inputType,
    payload: Array.from(input.payload),
  });
}

export function messageSigningIntent(accountIndex: number, messageBytes: Uint8Array) {
  return JSON.stringify({ kind: "message", accountIndex, messageBytes: Array.from(messageBytes) });
}

export async function authorizePendingRequest(input: {
  payload: string;
  dappOrigin: string;
  requestHash: string;
  accountIndex: number;
  intent: string;
}) {
  return await invoke<string>("authorize_pending_request", {
    payload: input.payload,
    dappOrigin: input.dappOrigin,
    requestHash: input.requestHash,
    accountIndex: input.accountIndex,
    intent: input.intent,
  });
}

async function authorizeLocalSigning(accountIndex: number, intent: string) {
  return await invoke<string>("authorize_local_signing", { accountIndex, intent });
}

async function resolveAuthorization(
  accountIndex: number,
  intent: string,
  context?: SigningAuthorizationContext,
): Promise<SigningAuthorizationContext> {
  if (context) return context;
  return { authorization: await authorizeLocalSigning(accountIndex, intent) };
}

interface NativeSignMessageResult {
  signature: number[];
  publicKey: number[];
  identity: string;
}

// ── Native session seed management ─────────────────────────────────────────────

export function zeroBytes(bytes: Uint8Array) {
  if (bytes.byteLength === 0) return;
  bytes.fill(0);
}

export async function clearSecureSession() {
  await invoke("clear_session_seeds").catch(() => {});
}

export async function unlockSecureSession(seeds: Seed[]): Promise<SessionWallet[]> {
  const wallets = seeds.map((seed) => ({
    identity: deriveIdentityFromSeed(seed),
    publicKey: publicKeyFromSeed(seed),
  }));
  await invoke("store_session_seeds", { seeds: seeds.map(String) });
  return wallets;
}

export function restoreSessionWalletsFromIdentities(identities: string[]): SessionWallet[] {
  return identities.map((identity) => ({
    identity,
    publicKey: identityToPublicKey(identity as import("@qubic.org/types").Identity),
  }));
}

// ── Signing — seed material remains native-side ────────────────────────────────

async function buildSignedTransaction({
  accountIndex,
  destination,
  amount,
  targetTick,
  currentTick,
  inputType,
  payload,
}: BuildTxParams, authorizationContext?: SigningAuthorizationContext): Promise<SignedTxResult> {
  const intent = transactionSigningIntent({ accountIndex, destination, amount, inputType, payload });
  const authorization = await resolveAuthorization(accountIndex, intent, authorizationContext);
  return await invoke<SignedTxResult>("sign_transaction", {
    request: {
      accountIndex,
      destination,
      amount: amount.toString(),
      targetTick,
      currentTick,
      inputType,
      payload: Array.from(payload),
      authorization: authorization.authorization,
      requestPayload: authorization.requestPayload,
      dappOrigin: authorization.dappOrigin,
      intent,
    },
  });
}

export function buildTransferFromSession(
  params: Omit<BuildTxParams, "inputType" | "payload">,
  authorizationContext?: SigningAuthorizationContext,
) {
  return buildSignedTransaction({ ...params, inputType: 0, payload: new Uint8Array(0) }, authorizationContext);
}

export function buildScTransactionFromSession(params: BuildTxParams, authorizationContext?: SigningAuthorizationContext) {
  return buildSignedTransaction(params, authorizationContext);
}

export async function signMessageFromSession(
  accountIndex: number,
  messageBytes: Uint8Array,
  authorizationContext?: SigningAuthorizationContext,
) {
  const intent = messageSigningIntent(accountIndex, messageBytes);
  const authorization = await resolveAuthorization(accountIndex, intent, authorizationContext);
  const result = await invoke<NativeSignMessageResult>("sign_message", {
    request: {
      accountIndex,
      messageBytes: Array.from(messageBytes),
      authorization: authorization.authorization,
      requestPayload: authorization.requestPayload,
      dappOrigin: authorization.dappOrigin,
      intent,
    },
  });
  return {
    signature: new Uint8Array(result.signature),
    publicKey: new Uint8Array(result.publicKey),
    identity: result.identity,
  };
}

/**
 * Signs only the canonical callback payload after the user has approved the
 * request. This is intentionally a separate native command from user-message
 * signing so a signature cannot be replayed for a different payload.
 */
export async function signCallbackMessageFromSession(
  accountIndex: number,
  messageBytes: Uint8Array,
  authorizationContext?: SigningAuthorizationContext,
) {
  if (!authorizationContext) throw new Error("request approval authorization is unavailable");
  const intent = "callback";
  const result = await invoke<NativeSignMessageResult>("sign_callback_message", {
    request: {
      accountIndex,
      messageBytes: Array.from(messageBytes),
      authorization: authorizationContext.authorization,
      requestPayload: authorizationContext.requestPayload,
      dappOrigin: authorizationContext.dappOrigin,
      intent,
    },
  });
  return {
    signature: new Uint8Array(result.signature),
    publicKey: new Uint8Array(result.publicKey),
    identity: result.identity,
  };
}
