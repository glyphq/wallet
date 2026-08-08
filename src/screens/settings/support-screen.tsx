import { useState } from "react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle, Code, Copy, QrCode, Star } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { SettingsPageHeader } from "@/components/settings-page-header";
import minerLabLogo from "@/assets/sponsors/minerlab.png";
import { DONATION_IDENTITY } from "@/data/sponsors";
import { stepMotion } from "@/lib/animations";
import { copyToClipboard } from "@/lib/clipboard";
import { formatQu } from "@/lib/format";
import { usePersistedStore } from "@/store/persisted";

const GITHUB_URL = "https://github.com/glyph-ecosystem/wallet";
const QR_BG = "var(--color-qr-surface)";
const QR_FG = "var(--color-qr-ink)";

export default function SupportScreen() {
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const sentTotal = pendingTxs
    .filter((tx) => tx.destination === DONATION_IDENTITY)
    .reduce((sum, tx) => sum + BigInt(tx.amount), 0n);

  async function copyAddress() {
    await copyToClipboard(DONATION_IDENTITY);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}>
      <motion.main {...stepMotion} style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)", paddingBottom: "var(--space-8)" }}>
        <SettingsPageHeader title="Support" />

        <section aria-labelledby="support-heading" style={{ paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "0.08em" }}>
            <Star size={13} weight="Bold" aria-hidden="true" /> COMMUNITY SUPPORT
          </span>
          <h1 id="support-heading" style={{ margin: "var(--space-3) 0 var(--space-2)", color: "var(--color-text-display)", fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: 400, lineHeight: "var(--leading-title)" }}>Keep Glyph independent.</h1>
          <p style={{ maxWidth: 480, margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)" }}>Glyph is maintained by the community. Sponsor support and contributions help keep it independent.</p>
        </section>

        <section aria-labelledby="sponsor-heading" style={{ borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: "var(--space-5)" }}>
          <SectionHeading title="Current sponsor" description="This contribution marks a meaningful milestone for the project." id="sponsor-heading" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
            <img src={minerLabLogo} alt="MinerLab" style={{ display: "block", width: "min(58%, 255px)", height: "auto", objectFit: "contain", objectPosition: "left center" }} />
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <strong style={{ display: "block", color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-title)", fontWeight: 600 }}>2B QU</strong>
              <span style={{ display: "block", marginTop: 2, color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>sponsored by MinerLab</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-4)", color: "var(--color-status-success)", fontSize: "var(--text-label)" }}>
            <CheckCircle size={15} weight="Bold" aria-hidden="true" />
            Sponsor milestone reached
          </div>
        </section>

        <section aria-labelledby="contribute-heading" style={{ borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: "var(--space-5)" }}>
          <SectionHeading title="Contribute" description="Send QU to support ongoing development." id="contribute-heading" />
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginTop: "var(--space-4)", padding: "var(--space-3) 0", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <code style={{ flex: 1, minWidth: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{DONATION_IDENTITY}</code>
            <Button size="sm" variant="secondary" onClick={() => void copyAddress()} style={{ flexShrink: 0, width: "auto" }}>
              {copied ? <CheckCircle size={15} weight="Bold" aria-hidden="true" /> : <Copy size={15} weight="Linear" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            <Button size="sm" variant="ghost" onClick={() => setShowQr((visible) => !visible)} style={{ width: "auto" }}>
              <QrCode size={16} weight="Linear" aria-hidden="true" />
              {showQr ? "Hide QR code" : "Show QR code"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void openUrl(GITHUB_URL)} style={{ width: "auto" }}>
              <Code size={16} weight="Linear" aria-hidden="true" />
              Open GitHub
            </Button>
          </div>
          {showQr && <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-4)", padding: "var(--space-5)", background: QR_BG }}><QRCodeSVG value={DONATION_IDENTITY} size={184} bgColor={QR_BG} fgColor={QR_FG} level="L" title="Glyph donation address QR code" /></div>}
        </section>

        <section aria-labelledby="your-support-heading" style={{ paddingBottom: "var(--space-6)" }}>
          <SectionHeading title="Your support" description="Contributions sent from this wallet." id="your-support-heading" />
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", marginTop: "var(--space-4)", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>Total donated</span>
            <strong style={{ color: sentTotal > 0n ? "var(--color-status-success)" : "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", fontWeight: 600 }}>{sentTotal > 0n ? `${formatQu(sentTotal)} QU` : "No donations yet"}</strong>
          </div>
        </section>
      </motion.main>
    </AppShell>
  );
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <>
      <h2 id={id} style={{ margin: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)" }}>{description}</p>
    </>
  );
}
