import {
  deriveIdentityFromSeed,
  identityToPublicKey,
  k12,
  publicKeyFromSeed,
  sign,
} from "@/lib/crypto";
import { buildTransaction, computeTransactionHash, encodeTransaction, signTransaction } from "@qubic.org/tx";
import type { Identity, Seed } from "@/lib/crypto";
import type { SessionWallet } from "@/lib/session-wallet";

const SC_DESTINATION = "A".repeat(60);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type SecretSeed = Uint8Array;

interface BuildTxParams {
  accountIndex: number;
  destination: string;
  amount: bigint;
  targetTick: number;
  currentTick?: number;
  inputType: number;
  payload: Uint8Array;
}

interface SignedTxResult {
  encoded: string;
  hash: string;
  bytes: Uint8Array;
}

let activeSeeds: SecretSeed[] = [];

function seedToBytes(seed: Seed): SecretSeed {
  return encoder.encode(seed);
}

function seedBytesToString(seed: SecretSeed): Seed {
  return decoder.decode(seed) as Seed;
}

function zeroBytes(bytes: Uint8Array) {
  bytes.fill(0);
}

function requireSeed(index: number): SecretSeed {
  const seed = activeSeeds[index];
  if (!seed) throw new Error("Unlocked account not available");
  return seed;
}

export function clearSecureSession() {
  for (const seed of activeSeeds) zeroBytes(seed);
  activeSeeds = [];
}

export function unlockSecureSession(seeds: Seed[]): SessionWallet[] {
  clearSecureSession();

  const wallets = seeds.map((seed) => {
    const publicKey = publicKeyFromSeed(seed);
    const identity = deriveIdentityFromSeed(seed);
    activeSeeds.push(seedToBytes(seed));
    return { identity, publicKey };
  });

  return wallets;
}

async function buildSignedTransaction({
  accountIndex,
  destination,
  amount,
  targetTick,
  currentTick,
  inputType,
  payload,
}: BuildTxParams): Promise<SignedTxResult> {
  const seed = seedBytesToString(requireSeed(accountIndex));
  const sourcePublicKey = publicKeyFromSeed(seed);
  const txBytes = buildTransaction({
    sourcePublicKey,
    destinationPublicKey: identityToPublicKey(destination as Identity),
    amount,
    targetTick,
    inputType,
    ...(payload.byteLength > 0 ? { payload } : {}),
    ...(currentTick !== undefined ? { currentTick } : {}),
  });
  const signed = await signTransaction(txBytes, seed);

  return {
    encoded: encodeTransaction(signed),
    hash: computeTransactionHash(signed),
    bytes: signed,
  };
}

export function buildTransferFromSession(params: Omit<BuildTxParams, "inputType" | "payload">) {
  return buildSignedTransaction({
    ...params,
    inputType: 0,
    payload: new Uint8Array(0),
  });
}

export function buildScTransactionFromSession({
  destination = SC_DESTINATION,
  ...params
}: Omit<BuildTxParams, "destination"> & { destination?: string }) {
  return buildSignedTransaction({
    ...params,
    destination,
  });
}

export async function signMessageFromSession(accountIndex: number, messageBytes: Uint8Array) {
  const seed = seedBytesToString(requireSeed(accountIndex));
  const digest = k12(messageBytes, 32);
  const signature = await sign(digest, seed);
  const publicKey = publicKeyFromSeed(seed);
  const identity = deriveIdentityFromSeed(seed);

  return { signature, publicKey, identity };
}
