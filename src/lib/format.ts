/** Shorten a Qubic identity or hash for display. head + tail chars, separated by "…". */
export function truncateId(id: string, head = 8, tail = 8): string {
  if (!id || id.length <= head + tail) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** Format a QU amount (bigint, string, or number) with locale-aware thousand separators. */
export function formatQu(amount: bigint | string | number): string {
  try {
    const n = typeof amount === "number" ? BigInt(Math.round(amount)) : BigInt(amount);
    return n.toLocaleString();
  } catch { return "—"; }
}
