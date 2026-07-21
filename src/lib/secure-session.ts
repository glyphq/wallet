import { invoke } from "@tauri-apps/api/core";
import { deriveIdentityFromSeed, identityToPublicKey, publicKeyFromSeed } from "@/lib/crypto";
import type { Seed } from "@/lib/crypto";
import type { SessionWallet } from "@/lib/session-wallet";

const encoder = new TextEncoder();

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

// ── Worker management ──────────────────────────────────────────────────────────

let _worker: Worker | null = null;
let _nextId = 0;
const _pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getSigningWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL("../workers/crypto.worker.ts", import.meta.url),
      { type: "module" },
    );
    _worker.onmessage = ({ data }: MessageEvent) => {
      const cb = _pending.get(data.id as number);
      if (!cb) return;
      _pending.delete(data.id as number);
      if (data.ok) cb.resolve(data);
      else cb.reject(new Error((data.error as string | undefined) ?? "Worker signing failed"));
    };
    _worker.onerror = (e) => {
      for (const [, cb] of _pending) cb.reject(new Error(e.message ?? "Worker error"));
      _pending.clear();
      _worker = null;
    };
  }
  return _worker;
}

function workerRequest<T>(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
  const id = _nextId++;
  return new Promise<T>((resolve, reject) => {
    _pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getSigningWorker().postMessage({ id, ...message }, transfer);
  });
}

// ── Native session seed management ─────────────────────────────────────────────

function seedToBytes(seed: Seed): Uint8Array {
  return encoder.encode(seed);
}

export function zeroBytes(bytes: Uint8Array) {
  // Transferring the seed buffer to the signing worker detaches this view in
  // the window. Detached and out-of-bounds views already expose no bytes and
  // throw when fill() is called, so only wipe views that still own storage.
  if (bytes.byteLength === 0) return;
  bytes.fill(0);
}

async function getSeedForSigning(accountIndex: number): Promise<Uint8Array> {
  const seed = await invoke<string>("get_session_seed_for_signing", { accountIndex });
  return seedToBytes(seed as Seed);
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

// ── Signing — seed material is fetched one-shot from native session ─────────────

async function buildSignedTransaction({
  accountIndex,
  destination,
  amount,
  targetTick,
  currentTick,
  inputType,
  payload,
}: BuildTxParams): Promise<SignedTxResult> {
  const seedCopy = await getSeedForSigning(accountIndex);
  try {
    return await workerRequest<SignedTxResult>({
      type: "sign_tx",
      seed: seedCopy,
      destination,
      amount: amount.toString(),
      targetTick,
      currentTick,
      inputType,
      payload,
    }, [seedCopy.buffer, payload.buffer]);
  } finally {
    zeroBytes(seedCopy);
  }
}

export function buildTransferFromSession(params: Omit<BuildTxParams, "inputType" | "payload">) {
  return buildSignedTransaction({ ...params, inputType: 0, payload: new Uint8Array(0) });
}

export function buildScTransactionFromSession(params: BuildTxParams) {
  return buildSignedTransaction(params);
}

export async function signMessageFromSession(accountIndex: number, messageBytes: Uint8Array) {
  const seedCopy = await getSeedForSigning(accountIndex);
  try {
    const result = await workerRequest<{ signature: Uint8Array; publicKey: Uint8Array; identity: string }>({
      type: "sign_message",
      seed: seedCopy,
      messageBytes,
    }, [seedCopy.buffer, messageBytes.buffer]);
    return {
      signature: new Uint8Array(result.signature),
      publicKey: new Uint8Array(result.publicKey),
      identity: result.identity,
    };
  } finally {
    zeroBytes(seedCopy);
  }
}
