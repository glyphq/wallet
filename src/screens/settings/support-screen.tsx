import { useState } from "react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle, Code, Copy, MedalStar, QrCode, Star } from "@solar-icons/react";
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
const CURRENT_SUPPORT = 2;
const NEXT_MILESTONE = 3;

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
      <motion.main {...stepMotion} style={{ width: "min(100%, 720px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)", paddingBottom: "var(--space-8)" }}>
        <SettingsPageHeader title="Support" />

        <section aria-labelledby="support-mission" style={{ position: "relative", overflow: "hidden", padding: "var(--space-6)", background: "linear-gradient(135deg, var(--color-bg-surface-2), var(--color-bg-elevated))", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-window)", boxShadow: "var(--shadow-elevated)" }}>
          <span aria-hidden="true" style={{ position: "absolute", right: -38, top: -66, width: 180, height: 180, borderRadius: "50%", background: "var(--color-wallet-accent-violet)", opacity: 0.12, filter: "blur(2px)" }} />
          <span aria-hidden="true" style={{ position: "absolute", right: 58, bottom: -74, width: 140, height: 140, borderRadius: "50%", background: "var(--color-wallet-accent-emerald)", opacity: 0.1, filter: "blur(2px)" }} />
          <div style={{ position: "relative" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", color: "var(--color-wallet-accent-emerald)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "0.1em" }}>
              <Star size={14} weight="Bold" aria-hidden="true" /> COMMUNITY QUEST
            </span>
            <h1 id="support-mission" style={{ maxWidth: 430, margin: "var(--space-3) 0 var(--space-2)", color: "var(--color-text-display)", fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem, 6vw, 2.4rem)", fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.03em" }}>Keep Glyph independent.</h1>
            <p style={{ maxWidth: 400, margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--text-body)", lineHeight: 1.5 }}>Every contribution funds a wallet built for its users, not a platform.</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
              <Pill label={`${CURRENT_SUPPORT}B QU backed`} tone="green" />
              <Pill label="1 active sponsor" tone="neutral" />
            </div>
          </div>
        </section>

        <section aria-labelledby="milestone-heading" style={{ padding: "var(--space-5)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-card)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)" }}>
            <div>
              <span style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em" }}>CURRENT MILESTONE</span>
              <h2 id="milestone-heading" style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", lineHeight: 1.2 }}>2B / 3B QU</h2>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "50%", background: "var(--color-wallet-accent-amber)", color: "var(--color-text-inverse)" }}><MedalStar size={19} weight="Bold" aria-hidden="true" /></span>
          </div>
          <div aria-label="2B of 3B QU current milestone" role="progressbar" aria-valuemin={0} aria-valuemax={NEXT_MILESTONE} aria-valuenow={CURRENT_SUPPORT} style={{ height: 8, marginTop: "var(--space-4)", overflow: "hidden", background: "var(--color-bg-inset)", borderRadius: "var(--radius-pill)" }}>
            <div style={{ width: `${(CURRENT_SUPPORT / NEXT_MILESTONE) * 100}%`, height: "100%", borderRadius: "inherit", background: "linear-gradient(90deg, var(--color-wallet-accent-emerald), var(--color-wallet-accent-sky))" }} />
          </div>
          <p style={{ margin: "var(--space-3) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.45 }}>1B QU remains before the next community milestone.</p>
        </section>

        <section aria-labelledby="sponsor-heading" style={{ display: "flex", alignItems: "stretch", overflow: "hidden", background: "var(--color-text-primary)", borderRadius: "var(--radius-card)" }}>
          <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", minWidth: 0, padding: "var(--space-5)", color: "var(--color-text-inverse)" }}>
            <div>
              <span style={{ color: "color-mix(in srgb, var(--color-text-inverse) 58%, transparent)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "0.09em" }}>FEATURED BACKER</span>
              <h2 id="sponsor-heading" style={{ margin: "var(--space-2) 0 0", fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", lineHeight: 1.2 }}>MinerLab</h2>
            </div>
            <span style={{ marginTop: "var(--space-5)", color: "color-mix(in srgb, var(--color-text-inverse) 68%, transparent)", fontSize: "var(--text-label)" }}>Pioneer tier · 2B QU contributed</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", width: "42%", minWidth: 136, padding: "var(--space-4)", background: "var(--color-bg-inset)" }}>
            <img src={minerLabLogo} alt="MinerLab" style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }} />
          </div>
        </section>

        <section aria-labelledby="join-heading" style={{ padding: "var(--space-5)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-card)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <div>
              <span style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em" }}>JOIN THE QUEST</span>
              <h2 id="join-heading" style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-title)" }}>Make your mark</h2>
            </div>
            {sentTotal > 0n && <Pill label="Supporter unlocked" tone="green" />}
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", marginTop: "var(--space-5)", padding: "var(--space-3)", background: "var(--color-bg-inset)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-control)" }}>
            <code style={{ flex: 1, minWidth: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", lineHeight: 1.5, overflowWrap: "anywhere" }}>{DONATION_IDENTITY}</code>
            <motion.button {...gesture.pressSubtle} type="button" onClick={() => void copyAddress()} aria-label={copied ? "Donation address copied" : "Copy donation address"} style={{ display: "inline-flex", flexShrink: 0, alignItems: "center", gap: "var(--space-1)", padding: "var(--space-1)", border: "none", background: "transparent", color: copied ? "var(--color-status-success)" : "var(--color-text-primary)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 700 }}>
              {copied ? <CheckCircle size={16} weight="Bold" aria-hidden="true" /> : <Copy size={16} weight="Linear" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </motion.button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            <ActionButton label={showQr ? "Hide QR" : "Show QR"} icon={<QrCode size={18} weight="Linear" aria-hidden="true" />} primary={false} onClick={() => setShowQr((visible) => !visible)} />
            <ActionButton label="Open GitHub" icon={<Code size={18} weight="Linear" aria-hidden="true" />} primary onClick={() => void openUrl(GITHUB_URL)} />
          </div>
          {showQr && <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--space-3)", padding: "var(--space-5)", background: QR_BG, borderRadius: "var(--radius-control)" }}><QRCodeSVG value={DONATION_IDENTITY} size={184} bgColor={QR_BG} fgColor={QR_FG} level="L" title="Glyph donation address QR code" /></div>}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-4)", color: sentTotal > 0n ? "var(--color-status-success)" : "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>
            <CheckCircle size={16} weight={sentTotal > 0n ? "Bold" : "Linear"} aria-hidden="true" />
            {sentTotal > 0n ? `${formatQu(sentTotal)} QU contributed from this wallet` : "Your first contribution unlocks your supporter status."}
          </div>
        </section>
      </motion.main>
    </AppShell>
  );
}

function Pill({ label, tone }: { label: string; tone: "green" | "neutral" }) {
  const background = tone === "green" ? "rgba(110, 231, 183, 0.16)" : "rgba(255, 255, 255, 0.08)";
  const color = tone === "green" ? "var(--color-wallet-accent-emerald)" : "var(--color-text-secondary)";
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", background, border: "1px solid color-mix(in srgb, currentColor 20%, transparent)", borderRadius: "var(--radius-pill)", color, fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", fontWeight: 700 }}>{label}</span>;
}

function ActionButton({ label, icon, primary, onClick }: { label: string; icon: React.ReactNode; primary: boolean; onClick: () => void }) {
  return <motion.button {...gesture.pressSubtle} type="button" onClick={onClick} style={{ display: "inline-flex", minHeight: "var(--height-button-md)", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", background: primary ? "var(--color-text-primary)" : "var(--color-bg-surface)", border: primary ? "1px solid var(--color-text-primary)" : "1px solid var(--color-border-default)", borderRadius: "var(--radius-control)", color: primary ? "var(--color-text-inverse)" : "var(--color-text-primary)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 700 }}>{icon}{label}</motion.button>;
}
