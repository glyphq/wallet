import { QRCodeSVG } from "qrcode.react";
import { Link01Icon, QrCodeIcon } from "@/lib/icons";
import { QR_BG, QR_FG, eyebrowStyle, sectionStyle, type PaymentLinkMode, type PaymentLinks } from "./payment-link-utils";

export function PaymentLinkPreview({
  links,
  mode,
  onModeChange,
}: {
  links: PaymentLinks;
  mode: PaymentLinkMode;
  onModeChange: (mode: PaymentLinkMode) => void;
}) {
  return (
    <>
      <section aria-labelledby="link-type-heading" style={sectionStyle}>
        <span id="link-type-heading" style={eyebrowStyle}>Link type</span>
        <div role="tablist" aria-label="QR link type" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--color-border-default)" }}>
          {(["web", "deep"] as const).map((option) => {
            const selected = mode === option;
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onModeChange(option)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-2)",
                  minHeight: 44,
                  padding: "0 var(--space-3)",
                  background: "transparent",
                  border: 0,
                  borderBottom: selected ? "1px solid var(--color-text-primary)" : "1px solid transparent",
                  color: selected ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  fontWeight: 600,
                }}
              >
                {option === "web" ? <Link01Icon size={14} /> : <QrCodeIcon size={14} />}
                {option === "web" ? "Web link" : "App link"}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="qr-preview-heading" style={{ ...sectionStyle, display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
        <span id="qr-preview-heading" style={{ ...eyebrowStyle, alignSelf: "stretch", marginBottom: 0 }}>QR and link preview</span>
        <div style={{ padding: "var(--space-3)", background: QR_BG, borderRadius: "var(--radius-card)" }} aria-label={`${mode === "web" ? "Web" : "App"} payment link QR code`}>
          <QRCodeSVG
            value={mode === "web" ? links.web : links.deep}
            size={200}
            bgColor={QR_BG}
            fgColor={QR_FG}
            level="M"
          />
        </div>
        <span style={{ alignSelf: "stretch", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", lineHeight: 1.45, textAlign: "center", wordBreak: "break-all" }}>
          {mode === "web" ? links.web : links.deep}
        </span>
      </section>
    </>
  );
}
