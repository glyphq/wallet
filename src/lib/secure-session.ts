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
}: BuildTxParams): Promise<SignedTxResult> {
  return await invoke<SignedTxResult>("sign_transaction", {
    request: {
      accountIndex,
      destination,
      amount: amount.toString(),
      targetTick,
      currentTick,
      inputType,
      payload: Array.from(payload),
    },
  });
}

export function buildTransferFromSession(params: Omit<BuildTxParams, "inputType" | "payload">) {
  return buildSignedTransaction({ ...params, inputType: 0, payload: new Uint8Array(0) });
}

export function buildScTransactionFromSession(params: BuildTxParams) {
  return buildSignedTransaction(params);
}

export async function signMessageFromSession(accountIndex: number, messageBytes: Uint8Array) {
  const result = await invoke<NativeSignMessageResult>("sign_message", {
    request: {
      accountIndex,
      messageBytes: Array.from(messageBytes),
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
export async function signCallbackMessageFromSession(accountIndex: number, messageBytes: Uint8Array) {
  const result = await invoke<NativeSignMessageResult>("sign_callback_message", {
    request: {
      accountIndex,
      messageBytes: Array.from(messageBytes),
    },
  });
  return {
    signature: new Uint8Array(result.signature),
    publicKey: new Uint8Array(result.publicKey),
    identity: result.identity,
  };
}
