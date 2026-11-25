/** Normalizes internal labels for notification copy. */
export function contractPhrase(name: string): string {
  return name.replace(/\s*·\s*/g, " ").trim();
}

/** Describes an address in prose without truncation glyphs. */
export function addressEnding(identity: string | null | undefined): string {
  const normalized = identity?.trim() ?? "";
  return normalized ? `the address ending with ${normalized.slice(-4)}` : "your account";
}

/** Formats a QU amount for a sentence. */
export function notificationAmount(amount: bigint | string): string {
  return `${BigInt(amount).toLocaleString()} QU`;
}
