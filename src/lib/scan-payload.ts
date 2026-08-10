import { isValidIdentity } from "@/lib/crypto";
import { parsePayLink, type PayLink } from "@/lib/pay-link";

const MAX_SCAN_PAYLOAD_CHARS = 12 * 1024;
const MAX_PAY_URL_LABEL_CHARS = 200;
const MAX_PAY_URL_AMOUNT = 9_223_372_036_854_775_807n;
const UNSAFE_URL_CHARS = /[\u0000-\u001f\u007f\s"'\\|]/;
const WEB_PAY_ORIGIN = "https://wallet.glyphq.org";

export type ScanPayloadSource = "identity" | "glyph-pay-link" | "web-pay-link" | "native-pay-json";

export interface ScannedIdentityPayload {
  kind: "identity";
  source: "identity";
  identity: string;
}

export interface ScannedPaymentPayload {
  kind: "payment-link";
  source: Exclude<ScanPayloadSource, "identity">;
  to: string;
  amount: string | null;
  label: string | null;
}

export type ScannedSendPayload = ScannedIdentityPayload | ScannedPaymentPayload;

function parsePositivePayAmount(amount: string | null): string | null | undefined {
  if (amount === null) return null;
  if (!/^\d+$/.test(amount)) return undefined;
  const value = BigInt(amount);
  if (value <= 0n || value > MAX_PAY_URL_AMOUNT) return undefined;
  return amount;
}

function readSingleAllowedQuery(url: URL): PayLink | null {
  const allowed = new Set(["to", "amount", "label"]);
  const seen = new Set<string>();
  let to: string | null = null;
  let amount: string | null = null;
  let label: string | null = null;

  for (const [key, value] of url.searchParams) {
    if (!allowed.has(key) || seen.has(key) || value === "") return null;
    if ([...value].some((char) => char < " " || char === "\u007f" || char === "\"" || char === "'" || char === "\\")) return null;
    seen.add(key);
    if (key === "to") to = value;
    if (key === "amount") amount = value;
    if (key === "label") label = [...value].slice(0, MAX_PAY_URL_LABEL_CHARS).join("");
  }

  if (!to) return null;
  const normalizedAmount = parsePositivePayAmount(amount);
  if (normalizedAmount === undefined) return null;

  return parsePayLink(JSON.stringify({ to, amount: normalizedAmount, label }));
}

function parseStrictPayUrl(raw: string): ScannedPaymentPayload | null {
  if (raw.length > MAX_SCAN_PAYLOAD_CHARS || UNSAFE_URL_CHARS.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.username || url.password || url.port || url.hash) return null;

  const isGlyphPay = url.protocol === "glyph:" && url.hostname === "pay" && (url.pathname === "" || url.pathname === "/");
  const isWebPay = url.protocol === "https:" && url.origin === WEB_PAY_ORIGIN && url.pathname === "/pay";
  if (!isGlyphPay && !isWebPay) return null;

  const pay = readSingleAllowedQuery(url);
  if (!pay) return null;

  return {
    kind: "payment-link",
    source: isGlyphPay ? "glyph-pay-link" : "web-pay-link",
    to: pay.to,
    amount: pay.amount,
    label: pay.label,
  };
}

export function parseScannedSendPayload(raw: string): ScannedSendPayload | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_SCAN_PAYLOAD_CHARS) return null;

  const identity = trimmed.toUpperCase();
  if (isValidIdentity(identity)) return { kind: "identity", source: "identity", identity };

  const nativePay = parsePayLink(trimmed);
  if (nativePay) {
    return {
      kind: "payment-link",
      source: "native-pay-json",
      to: nativePay.to,
      amount: nativePay.amount,
      label: nativePay.label,
    };
  }

  return parseStrictPayUrl(trimmed);
}
