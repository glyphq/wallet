import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Copy, SendSquare } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { SettingsPageHeader } from "@/components/settings-page-header";
import minerLabLogo from "@/assets/sponsors/minerlab.png";
import { DONATION_IDENTITY } from "@/data/sponsors";
import { stepMotion } from "@/lib/animations";
import { copyToClipboard } from "@/lib/clipboard";
import { formatQu } from "@/lib/format";
import { usePersistedStore } from "@/store/persisted";

const QR_BG = "var(--color-qr-surface)";
const QR_FG = "var(--color-qr-ink)";

export default function SupportScreen() {
  const navigate = useNavigate();
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const [copied, setCopied] = useState(false);
  const sentTotal = pendingTxs
    .filter((tx) => tx.destination === DONATION_IDENTITY)
    .reduce((sum, tx) => sum + BigInt(tx.amount), 0n);

  async function copyAddress() {
    await copyToClipboard(DONATION_IDENTITY);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  function donate() {
    navigate(`/send?to=${encodeURIComponent(DONATION_IDENTITY)}`);
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}>
      <motion.main {...stepMotion} style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)", paddingBottom: "var(--space-8)" }}>
        <SettingsPageHeader title="Support" />

        <section aria-labelledby="donation-address-heading" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: "var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-4)", background: QR_BG }}>
            <QRCodeSVG value={DONATION_IDENTITY} size={184} bgColor={QR_BG} fgColor={QR_FG} level="L" title="Glyph donation address QR code" />
          </div>
          <h1 id="donation-address-heading" style={{ margin: "var(--space-5) 0 var(--space-2)", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>Support Glyph</h1>
          <code style={{ maxWidth: 340, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: 1.55, overflowWrap: "anywhere" }}>{DONATION_IDENTITY}</code>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
            <Button size="md" variant="primary" onClick={donate} style={{ width: "auto" }}>
              <SendSquare size={17} weight="Linear" aria-hidden="true" />
              Donate
            </Button>
            <Button size="md" variant="secondary" onClick={() => void copyAddress()} style={{ width: "auto" }}>
              {copied ? <CheckCircle size={17} weight="Bold" aria-hidden="true" /> : <Copy size={17} weight="Linear" aria-hidden="true" />}
              {copied ? "Copied" : "Copy address"}
            </Button>
          </div>
        </section>

        <section aria-label="Sponsors">
          <SponsorTicker />
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
    <div className="sponsor-ticker" aria-label="MinerLab has committed 2B QU.">
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
      <strong className="sponsor-ticker-amount">2B QU</strong>
    </div>
  );
}
