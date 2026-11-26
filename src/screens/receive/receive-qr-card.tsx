import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

// High-contrast pair required for QR readability
const QR_BG = "var(--color-qr-surface)";
const QR_FG = "var(--color-qr-ink)";

export function ReceiveQrCard({ identity, hideBalances }: { identity: string; hideBalances: boolean }) {
  const [qrRevealed, setQrRevealed] = useState(false);

  return (
    <div
      role={hideBalances ? "button" : undefined}
      tabIndex={hideBalances ? 0 : undefined}
      aria-label={hideBalances ? (qrRevealed ? "Hide QR code" : "Reveal QR code") : undefined}
      style={{
        background: QR_BG,
        borderRadius: "var(--radius-sharp)",
        padding: "var(--space-2)",
        position: "relative",
        cursor: hideBalances && !qrRevealed ? "pointer" : "default",
      }}
      onMouseEnter={() => hideBalances && setQrRevealed(true)}
      onMouseLeave={() => hideBalances && setQrRevealed(false)}
      onClick={() => hideBalances && setQrRevealed((v) => !v)}
      onKeyDown={(e) => { if (hideBalances && (e.key === "Enter" || e.key === " ")) setQrRevealed((v) => !v); }}
    >
      <QRCodeSVG
        value={identity}
        size={260}
        bgColor={QR_BG}
        fgColor={QR_FG}
        level="M"
        aria-label={`QR code for address ${identity}`}
        role="img"
        includeMargin
        style={{ display: "block", filter: hideBalances && !qrRevealed ? "blur(12px)" : "none", transition: "filter 0.15s ease" }}
      />
      {hideBalances && !qrRevealed && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-qr-overlay)", borderRadius: "var(--radius-sharp)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-bg-base)" }}>
            Tap or hover to reveal
          </span>
        </div>
      )}
    </div>
  );
}
