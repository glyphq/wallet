export type { Identity, Seed } from "@qubic.org/types";
export {
  toSeed,
  isIdentity,
  isSeed,
  InvalidSeedError,
  InvalidIdentityError,
} from "@qubic.org/types";
export {
  generateRandomSeed,
  deriveIdentityFromSeed,
  publicKeyFromSeed,
  identityToPublicKey,
  publicKeyToIdentity,
  sign,
  verify,
  k12,
} from "@qubic.org/crypto";

import { identityToPublicKey as _identityToPublicKey } from "@qubic.org/crypto";

/** Full identity validation: checks format AND the 4-char checksum embedded in positions 56–59. */
export function isValidIdentity(s: string): boolean {
  try {
    _identityToPublicKey(s as import("@qubic.org/types").Identity);
    return true;
  } catch {
    return false;
  }
}

export function truncateIdentity(identity: string): string {
  if (identity.length <= 20) return identity;
  return `${identity.slice(0, 10)}...${identity.slice(-10)}`;
}
