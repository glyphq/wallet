import { useState } from "react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle, Code, Copy, QrCode } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import minerLabLogo from "@/assets/sponsors/minerlab.png";
import { DONATION_IDENTITY } from "@/data/sponsors";
import { stepMotion, gesture } from "@/lib/animations";
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
      <motion.main {...stepMotion} style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Support" />

        <section aria-labelledby="sponsor-heading" style={{ paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <SectionTitle id="sponsor-heading" title="Current sponsor" description="Supporting Glyph's continued development." />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", width: "min(100%, 310px)", minHeight: 76, padding: "var(--space-3) var(--space-4)", background: "var(--color-text-primary)" }}>
                <img src={minerLabLogo} alt="MinerLab" style={{ display: "block", width: "100%", height: "auto", maxHeight: 52, objectFit: "contain", objectPosition: "left center" }} />
              </div>
              <span style={{ display: "block", marginTop: "var(--space-3)", color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>MinerLab has contributed 2B QU.</span>
            </div>
            <span style={{ flexShrink: 0, color: "var(--color-accent)", fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", fontWeight: 600 }}>2B QU</span>
          </div>
        </section>

        <section aria-labelledby="donate-heading" style={{ paddingBottom: "var(--space-5)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <SectionTitle id="donate-heading" title="Donate QU" description="Contributions help keep the wallet independent and maintained." />
          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginTop: "var(--space-4)", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <code style={{ flex: 1, minWidth: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: 1.55, overflowWrap: "anywhere" }}>{DONATION_IDENTITY}</code>
            <motion.button
              {...gesture.pressSubtle}
              type="button"
              onClick={() => void copyAddress()}
              aria-label={copied ? "Donation address copied" : "Copy donation address"}
              style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", padding: "var(--space-1)", border: "none", background: "transparent", color: copied ? "var(--color-status-success)" : "var(--color-accent)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600 }}
            >
              {copied ? <CheckCircle size={16} weight="Bold" aria-hidden="true" /> : <Copy size={16} weight="Linear" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </motion.button>
          </div>
          <ActionRow label={showQr ? "Hide donation QR code" : "Show donation QR code"} icon={<QrCode size={17} weight="Linear" aria-hidden="true" />} onClick={() => setShowQr((visible) => !visible)} />
          {showQr && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-4)", padding: "var(--space-4)", background: QR_BG }}>
              <QRCodeSVG value={DONATION_IDENTITY} size={180} bgColor={QR_BG} fgColor={QR_FG} level="L" title="Glyph donation address QR code" />
            </div>
          )}
          {sentTotal > 0n && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-4)", color: "var(--color-status-success)", fontSize: "var(--text-label)" }}>
              <CheckCircle size={16} weight="Bold" aria-hidden="true" />
              {formatQu(sentTotal)} QU donated from this wallet
            </div>
          )}
        </section>

        <section aria-labelledby="source-heading" style={{ paddingBottom: "var(--space-6)" }}>
          <SectionTitle id="source-heading" title="Open source" description="Review the code, report an issue, or contribute to Glyph." />
          <ActionRow label="Open GitHub" detail="glyph-ecosystem/wallet" icon={<Code size={17} weight="Linear" aria-hidden="true" />} onClick={() => void openUrl(GITHUB_URL)} />
        </section>
      </motion.main>
    </AppShell>
  );
}

function SectionTitle({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <>
      <h2 id={id} style={{ margin: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.45 }}>{description}</p>
    </>
  );
}

function ActionRow({ label, detail, icon, onClick }: { label: string; detail?: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      type="button"
      onClick={onClick}
      style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", padding: "var(--space-3) 0", border: "none", borderBottom: "1px solid var(--color-border-subtle)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer", textAlign: "left" }}
    >
      <span style={{ display: "flex", minWidth: 0, alignItems: "center", gap: "var(--space-3)" }}>
        <span style={{ display: "flex", color: "var(--color-text-secondary)" }}>{icon}</span>
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: "var(--text-label)", fontWeight: 600 }}>{label}</strong>
          {detail && <span style={{ display: "block", marginTop: 2, color: "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{detail}</span>}
        </span>
      </span>
      <span aria-hidden="true" style={{ color: "var(--color-accent)", fontSize: "var(--text-body)" }}>›</span>
    </motion.button>
  );
}
