import { Link01Icon } from "@/lib/icons";
import { eyebrowStyle, sectionStyle } from "./payment-link-utils";

export function PaymentLinkUnavailable() {
  return (
    <section aria-labelledby="payment-link-empty-heading" style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
      <span id="payment-link-empty-heading" style={eyebrowStyle}>Link unavailable</span>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
        <Link01Icon size={18} style={{ flex: "0 0 auto", marginTop: 2, color: "var(--color-text-tertiary)" }} />
        <div>
          <p style={{ margin: 0, color: "var(--color-text-primary)", fontSize: "var(--text-body)", lineHeight: 1.45 }}>
            Select an account with a valid receiving identity to generate a payment link.
          </p>
          <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-tertiary)", fontSize: "var(--text-caption)", lineHeight: 1.45 }}>
            Amount and label remain optional and only pre-fill the sender's payment.
          </p>
        </div>
      </div>
    </section>
  );
}
