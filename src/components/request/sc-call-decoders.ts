import { publicKeyToIdentity } from "@qubic.org/crypto";

export interface ScCallRecipient {
  identity: string;
  amount: bigint;
}

export interface QearnUnlockPayload {
  amount: bigint;
  epoch: number;
}

export interface MultiSignVaultDepositPayload {
  vaultId: bigint;
}

export interface MultiSignVaultResetReleasePayload {
  vaultId: bigint;
}

export interface MultiSignVaultReleasePayload {
  vaultId: bigint;
  amount: bigint;
  destination: string;
}

/** Renders a base64 payload as space-separated lowercase hex bytes. */
export function base64ToHex(b64: string): string {
  try {
    const binary = atob(b64);
    return Array.from(binary, (c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
  } catch {
    return "[invalid payload]";
  }
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readU64(view: DataView, offset: number): bigint {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return (BigInt(hi) << 32n) | BigInt(lo);
}

// Decode QUtil SendToManyV1 payload: 25×32-byte pubkeys + 25×8-byte uint64 amounts (LE)
export function decodeQUtilSendToMany(bytes: Uint8Array): ScCallRecipient[] | null {
  if (bytes.length !== 800 + 200) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const results: ScCallRecipient[] = [];
  for (let i = 0; i < 25; i++) {
    const pubKey = bytes.slice(i * 32, (i + 1) * 32);
    const amountOffset = 800 + i * 8;
    const amount = readU64(view, amountOffset);
    if (amount === 0n) continue;
    try {
      const identity = publicKeyToIdentity(pubKey) as string;
      results.push({ identity, amount });
    } catch {
      // skip invalid entries
    }
  }
  return results;
}

// Decode Qearn UnlockInQearn payload: 8-byte uint64 amount + 4-byte uint32 epoch (LE)
export function decodeQearnUnlock(bytes: Uint8Array): QearnUnlockPayload | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const amount = readU64(view, 0);
  const epoch = readU32(view, 8);
  return { amount, epoch };
}

export function decodeMultiSignVaultDeposit(bytes: Uint8Array): MultiSignVaultDepositPayload | null {
  if (bytes.length < 8) return null;
  return { vaultId: readU64(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0) };
}

export function decodeMultiSignVaultResetRelease(bytes: Uint8Array): MultiSignVaultResetReleasePayload | null {
  if (bytes.length < 8) return null;
  return { vaultId: readU64(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0) };
}

export function decodeMultiSignVaultRelease(bytes: Uint8Array): MultiSignVaultReleasePayload | null {
  if (bytes.length < 48) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    return {
      vaultId: readU64(view, 0),
      amount: readU64(view, 8),
      destination: publicKeyToIdentity(bytes.slice(16, 48)) as string,
    };
  } catch {
    return null;
  }
}
