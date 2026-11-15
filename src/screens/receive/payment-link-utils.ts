const WEB_BASE = "https://wallet.glyphq.org/pay";

export const QR_BG = "var(--color-qr-surface)";
export const QR_FG = "var(--color-qr-ink)";

export type PaymentLinkMode = "web" | "deep";

export interface PaymentLinks {
  web: string;
  deep: string;
}

export function buildLinks(to: string, amount: string, label: string): PaymentLinks {
  const params = new URLSearchParams({ to });
  const amountNum = amount.trim().replace(/\D/g, "");
  if (amountNum && BigInt(amountNum) > 0n) params.set("amount", amountNum);
  if (label.trim()) params.set("label", label.trim());
  const query = params.toString();
  return {
    web: `${WEB_BASE}?${query}`,
    deep: `glyph://pay?${query}`,
  };
}

export const sectionStyle = {
  borderTop: "1px solid var(--color-border-default)",
  paddingTop: "var(--space-4)",
} as const;

export const eyebrowStyle = {
  display: "block",
  marginBottom: "var(--space-3)",
  color: "var(--color-text-tertiary)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
} as const;
