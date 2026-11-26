/** Normalizes internal labels for notification copy. */
export function contractPhrase(name: string): string {
  return name.replace(/\s*·\s*/g, " ").trim();
}

/** Shortens an identity to four characters, three dots, four characters. */
export function notificationAddress(identity: string | null | undefined): string {
  const normalized = identity?.trim() ?? "";
  if (!normalized) return "your account";
  if (normalized.length <= 8) return normalized;
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

/** Formats a QU amount for a sentence. */
export function notificationAmount(amount: bigint | string): string {
  return `${BigInt(amount).toLocaleString()} QU`;
}
