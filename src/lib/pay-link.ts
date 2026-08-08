import { isValidIdentity } from "@/lib/crypto";

const MAX_PAY_LABEL_CHARS = 256;
const MAX_UINT64 = 18_446_744_073_709_551_615n;

export interface PayLink {
  to: string;
  amount: string | null;
  label: string | null;
}

/** Parses native deep-link data before it is reflected into the send route. */
export function parsePayLink(raw: string): PayLink | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { to, amount, label } = parsed as Record<string, unknown>;
    if (typeof to !== "string" || !isValidIdentity(to)) return null;
    if (amount !== undefined && amount !== null && (
      typeof amount !== "string" || !/^\d+$/.test(amount) || BigInt(amount) > MAX_UINT64
    )) return null;
    if (label !== undefined && label !== null && (
      typeof label !== "string" || label.length > MAX_PAY_LABEL_CHARS
    )) return null;
    return { to, amount: amount ?? null, label: label ?? null };
  } catch {
    return null;
  }
}
