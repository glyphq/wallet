import { useState } from "react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle, Code, Copy, QrCode } from "@solar-icons/react";
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

        <section aria-labelledby="support-heading">
          <h1 id="support-heading" style={{ margin: 0, color: "var(--color-text-display)", fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: 400, lineHeight: "var(--leading-title)" }}>Back independent software.</h1>
          <p style={{ maxWidth: 450, margin: "var(--space-3) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)" }}>Glyph is supported by people and teams who want a wallet that remains open, local, and community-led.</p>
        </section>

        <section aria-labelledby="sponsors-heading">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)", marginBottom: "var(--space-3)" }}>
            <div>
              <h2 id="sponsors-heading" style={{ margin: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>Sponsors</h2>
              <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>Current project backers</p>
            </div>
            <span style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)" }}>2B QU committed</span>
          </div>
          <SponsorTicker />
        </section>

        <section aria-labelledby="contribute-heading" style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)" }}>
          <h2 id="contribute-heading" style={{ margin: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>Contribute</h2>
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)" }}>Send QU to keep development moving. Your address is copied exactly as displayed.</p>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginTop: "var(--space-4)", padding: "var(--space-3) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
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
              View on GitHub
            </Button>
          </div>
          {showQr && <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-4)", padding: "var(--space-5)", background: QR_BG }}><QRCodeSVG value={DONATION_IDENTITY} size={184} bgColor={QR_BG} fgColor={QR_FG} level="L" title="Glyph donation address QR code" /></div>}
        </section>

        <section aria-label="Your contribution history" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--color-border-subtle)" }}>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>Sent from this wallet</span>
          <strong style={{ color: sentTotal > 0n ? "var(--color-status-success)" : "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", fontWeight: 600 }}>{sentTotal > 0n ? `${formatQu(sentTotal)} QU` : "No donations yet"}</strong>
        </section>
      </motion.main>
    </AppShell>
  );
}

function SponsorTicker() {
  return (
    <div className="sponsor-ticker" aria-label="Current sponsors. MinerLab has committed 2B QU.">
      <div className="sponsor-ticker-track">
        <SponsorTickerGroup />
        <SponsorTickerGroup hidden />
      </div>
    </div>
  );
}

function SponsorTickerGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className="sponsor-ticker-group" aria-hidden={hidden || undefined}>
      <SponsorTickerEntry />
      <SponsorTickerEntry />
    </div>
  );
}

function SponsorTickerEntry() {
  return (
    <div className="sponsor-ticker-entry">
      <img className="sponsor-ticker-logo" src={minerLabLogo} alt="" />
      <span style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", whiteSpace: "nowrap" }}>CURRENT SPONSOR · 2B QU</span>
    </div>
  );
}
