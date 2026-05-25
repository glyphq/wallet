export function exceedsHighValueThreshold(amount: bigint, threshold: string): boolean {
  if (!threshold.trim() || !/^\d+$/.test(threshold)) return false;
  try {
    return amount >= BigInt(threshold);
  } catch {
    return false;
  }
}
