export function exceedsHighValueThreshold(amount: bigint, threshold: string): boolean {
  if (!threshold.trim() || !/^\d+$/.test(threshold)) return false;
  try {
    return amount >= BigInt(threshold);
  } catch {
    return false;
  }
}

/**
 * Biometric seed reveal can only be enforced for a wallet that is actually
 * enrolled. Otherwise the requirement is unsatisfiable and would lock the user
 * out of viewing their own seed.
 */
export function requiresBiometricSeedReveal(
  requireBiometricForSeedReveal: boolean,
  biometricWalletIds: readonly string[],
  walletId: string | null | undefined,
): boolean {
  return requireBiometricForSeedReveal && !!walletId && biometricWalletIds.includes(walletId);
}
