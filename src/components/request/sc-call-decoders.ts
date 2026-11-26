import { decodeFields, MSVAULT, QUTIL, type ContractCall, type ContractDefinition } from "@glyph-oss/contracts";

export interface ScCallRecipient {
  identity: string;
  amount: bigint;
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

function decodeInput(
  contract: ContractDefinition,
  call: ContractCall | undefined,
  bytes: Uint8Array,
): Record<string, unknown> | null {
  if (!call) return null;
  try {
    return decodeFields(bytes, call.inputFields, contract) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Decode a QUTIL SendToManyV1 payload from its maintained ABI. */
export function decodeQUtilSendToMany(bytes: Uint8Array): ScCallRecipient[] | null {
  const decoded = decodeInput(QUTIL.definition, QUTIL.procedures.SendToManyV1, bytes);
  if (!decoded) return null;

  const results: ScCallRecipient[] = [];
  for (let i = 0; i < 25; i++) {
    const amount = decoded[`amt${i}`] as bigint;
    if (amount === 0n) continue;
    results.push({ identity: decoded[`dst${i}`] as string, amount });
  }
  return results;
}

/** Decode an MSVAULT deposit payload from its maintained ABI. */
export function decodeMultiSignVaultDeposit(bytes: Uint8Array): MultiSignVaultDepositPayload | null {
  const decoded = decodeInput(MSVAULT.definition, MSVAULT.procedures.deposit, bytes);
  return decoded ? { vaultId: decoded.vaultId as bigint } : null;
}

/** Decode an MSVAULT resetRelease payload from its maintained ABI. */
export function decodeMultiSignVaultResetRelease(bytes: Uint8Array): MultiSignVaultResetReleasePayload | null {
  const decoded = decodeInput(MSVAULT.definition, MSVAULT.procedures.resetRelease, bytes);
  return decoded ? { vaultId: decoded.vaultId as bigint } : null;
}

/** Decode an MSVAULT releaseTo payload from its maintained ABI. */
export function decodeMultiSignVaultRelease(bytes: Uint8Array): MultiSignVaultReleasePayload | null {
  const decoded = decodeInput(MSVAULT.definition, MSVAULT.procedures.releaseTo, bytes);
  if (!decoded) return null;
  return {
    vaultId: decoded.vaultId as bigint,
    amount: decoded.amount as bigint,
    destination: decoded.destination as string,
  };
}
