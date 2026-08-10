import { identityToPublicKey, publicKeyToIdentity } from "@qubic.org/crypto";
import { toIdentity } from "@qubic.org/types";
import {
  buildTransaction,
  computeTransactionHash,
  decodeTransaction,
  encodeTransaction,
  verifyTransactionSignature,
} from "@qubic.org/tx";
import type { ExternalSignerRequest } from "@/store/persisted";

const I64_MAX = 9_223_372_036_854_775_807n;
const U32_MAX = 4_294_967_295;
const SIGNATURE_SIZE = 64;

export const EXTERNAL_SIGNER_SUPPORT = {
  directHardwareTransport: false,
  reason: "No Qubic hardware-wallet transport dependency is installed.",
  unsignedExport: true,
  signedImport: true,
} as const;

export interface ExternalSignerTransferDraft {
  sourceIdentity: string;
  destinationIdentity: string;
  amount: string;
  targetTick: string;
}

export interface VerifiedExternalSignerImport {
  signedTxBase64: string;
  txHash: string;
  sourceIdentity: string;
  destinationIdentity: string;
  amount: string;
  targetTick: number;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytesStrict(value: string): Uint8Array {
  const compact = value.replace(/\s+/g, "");
  if (!compact) throw new Error("Base64 data is required.");
  if (compact.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error("Base64 data is malformed.");
  }
  try {
    const binary = atob(compact);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("Base64 data is malformed.");
  }
}

export function normalizeExternalSignerIdentity(value: string): string {
  return toIdentity(value.trim().toUpperCase()).toString();
}

export function normalizeExternalSignerAmount(value: string): string {
  const compact = value.trim();
  if (!/^\d+$/.test(compact)) throw new Error("Amount must be an unsigned integer.");
  const amount = BigInt(compact);
  if (amount <= 0n) throw new Error("Amount must be greater than zero.");
  if (amount > I64_MAX) throw new Error("Amount exceeds Qubic transaction limits.");
  return amount.toString();
}

export function normalizeExternalSignerTargetTick(value: string): number {
  const compact = value.trim();
  if (!/^\d+$/.test(compact)) throw new Error("Target tick must be an unsigned integer.");
  const tick = Number(compact);
  if (!Number.isSafeInteger(tick) || tick <= 0 || tick > U32_MAX) {
    throw new Error("Target tick is outside Qubic transaction limits.");
  }
  return tick;
}

export function createExternalSignerTransferRequest(
  draft: ExternalSignerTransferDraft,
  now = Date.now(),
  id = makeExternalSignerRequestId(now)
): ExternalSignerRequest {
  const sourceIdentity = normalizeExternalSignerIdentity(draft.sourceIdentity);
  const destinationIdentity = normalizeExternalSignerIdentity(draft.destinationIdentity);
  const amount = normalizeExternalSignerAmount(draft.amount);
  const targetTick = normalizeExternalSignerTargetTick(draft.targetTick);
  const unsignedTx = buildTransaction({
    sourcePublicKey: identityToPublicKey(toIdentity(sourceIdentity)),
    destinationPublicKey: identityToPublicKey(toIdentity(destinationIdentity)),
    amount: BigInt(amount),
    targetTick,
    inputType: 0,
  });

  return {
    id,
    createdAt: now,
    sourceIdentity,
    destinationIdentity,
    amount,
    targetTick,
    inputType: 0,
    payloadBase64: "",
    unsignedTxBase64: bytesToBase64(unsignedTx),
    status: "exported",
  };
}

export function verifyExternalSignedTransaction(
  request: ExternalSignerRequest,
  signedTxBase64: string
): VerifiedExternalSignerImport {
  const unsignedBytes = base64ToBytesStrict(request.unsignedTxBase64);
  const signedBytes = base64ToBytesStrict(signedTxBase64);
  if (signedBytes.length !== unsignedBytes.length + SIGNATURE_SIZE) {
    throw new Error("Signed transaction length does not match the exported request.");
  }
  for (let index = 0; index < unsignedBytes.length; index += 1) {
    if (signedBytes[index] !== unsignedBytes[index]) {
      throw new Error("Signed transaction does not match the exported request.");
    }
  }
  if (!verifyTransactionSignature(signedBytes)) {
    throw new Error("Signed transaction signature could not be verified.");
  }

  const decoded = decodeTransaction(signedBytes);
  const sourceIdentity = publicKeyToIdentity(decoded.sourcePublicKey).toString();
  const destinationIdentity = publicKeyToIdentity(decoded.destinationPublicKey).toString();
  if (
    sourceIdentity !== request.sourceIdentity ||
    destinationIdentity !== request.destinationIdentity ||
    decoded.amount.toString() !== request.amount ||
    decoded.targetTick !== request.targetTick ||
    decoded.inputType !== request.inputType ||
    decoded.payload.length !== 0
  ) {
    throw new Error("Signed transaction review details do not match the exported request.");
  }

  return {
    signedTxBase64: encodeTransaction(signedBytes).toString(),
    txHash: computeTransactionHash(signedBytes).toString(),
    sourceIdentity,
    destinationIdentity,
    amount: decoded.amount.toString(),
    targetTick: decoded.targetTick,
  };
}

export function makeExternalSignerRequestId(now = Date.now()): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `external-${crypto.randomUUID()}`;
  }
  return `external-${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
