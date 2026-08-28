import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { SendSquare } from "@solar-icons/react";
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
  const themeMode = usePersistedStore((s) => s.settings.themeMode);
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

        <section aria-label="Donate to Glyph" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: "var(--space-6)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-4)", background: QR_BG }}>
            <QRCodeSVG value={DONATION_IDENTITY} size={184} bgColor={QR_BG} fgColor={QR_FG} level="L" title="Glyph donation address QR code" />
          </div>
          <button type="button" onClick={() => void copyAddress()} aria-label="Copy donation address" title={copied ? "Address copied" : "Copy donation address"} style={{ maxWidth: 340, marginTop: "var(--space-5)", padding: 0, border: "none", background: "transparent", color: "var(--color-text-secondary)", cursor: "copy" }}>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: 1.55, overflowWrap: "anywhere" }}>{DONATION_IDENTITY}</code>
          </button>
          <span className="sr-only" aria-live="polite">{copied ? "Donation address copied" : ""}</span>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
            <Button size="md" variant="primary" onClick={donate} style={{ width: "auto" }}>
              <SendSquare size={17} weight="Linear" aria-hidden="true" />
              Donate
            </Button>
          </div>
        </section>

        <section aria-label="Sponsors">
          <SponsorTicker invertLogo={themeMode === "light"} />
        </section>

        <section aria-label="Your contribution history" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--color-border-subtle)" }}>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>Sent from this Vault</span>
          <strong style={{ color: sentTotal > 0n ? "var(--color-status-success)" : "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", fontWeight: 600 }}>{sentTotal > 0n ? `${formatQu(sentTotal)} QU` : "No donations yet"}</strong>
        </section>
      </motion.main>
    </AppShell>
  );
}

function SponsorTicker({ invertLogo }: { invertLogo: boolean }) {
  return (
    <div className="sponsor-ticker" aria-label="MinerLab has committed 2B QU.">
      <div className="sponsor-ticker-track">
        <SponsorTickerGroup invertLogo={invertLogo} />
        <SponsorTickerGroup hidden invertLogo={invertLogo} />
      </div>
    </div>
  );
}

function SponsorTickerGroup({ hidden = false, invertLogo }: { hidden?: boolean; invertLogo: boolean }) {
  return (
    <div className="sponsor-ticker-group" aria-hidden={hidden || undefined}>
      <SponsorTickerEntry invertLogo={invertLogo} />
      <SponsorTickerEntry invertLogo={invertLogo} />
    </div>
  );
}

function SponsorTickerEntry({ invertLogo }: { invertLogo: boolean }) {
  return (
    <div className="sponsor-ticker-entry">
      <img className="sponsor-ticker-logo" src={minerLabLogo} alt="" style={{ filter: invertLogo ? "invert(1)" : undefined }} />
      <strong className="sponsor-ticker-amount">2B QU</strong>
    </div>
  );
}
