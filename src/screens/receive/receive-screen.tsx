import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { Copy, CheckCircle, LinkRound } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { IdentityDisplay } from "@/components/identity-display";
import { Identicon } from "@/components/identicon";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { copyToClipboard } from "@/lib/clipboard";
import { truncateId } from "@/lib/format";

// High-contrast pair required for QR readability
const QR_BG = "var(--color-qr-surface)";
const QR_FG = "var(--color-qr-ink)";

export default function ReceiveScreen() {
  const navigate = useNavigate();

  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const wallets = useSessionStore((s) => s.wallets);

  const activeIndex = settings.activeAccountIndex;
  const identity = getVaultAccountIdentity(vault ?? null, activeIndex, wallets);
  const accountName = vault?.accounts[activeIndex]?.name ?? `Account ${activeIndex + 1}`;
  const hideBalances = settings.hideBalances;
  const [qrRevealed, setQrRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!identity) return;
    const clearSecs = settings.clipboardClearSeconds;
    await copyToClipboard(identity, clearSecs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div
        {...stepMotion}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-5)" }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" size="sm" shape="sharp" onClick={() => navigate("/payment-link")}>
            <LinkRound size={16} aria-hidden="true" />
            Payment link
          </Button>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {identity && <Identicon kind="account" code={`A${settings.activeAccountIndex + 1}`} seed={identity} label={vault?.accounts[settings.activeAccountIndex]?.name} size={36} radius={8} />}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-display)" }}>
                {accountName}
              </span>
              {identity && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
                  {truncateId(identity, 10, 10)}
                </span>
              )}
            </div>
          </div>

          {identity ? (
            <>
            <div
              role={hideBalances ? "button" : undefined}
              tabIndex={hideBalances ? 0 : undefined}
              aria-label={hideBalances ? (qrRevealed ? "Hide QR code" : "Reveal QR code") : undefined}
              style={{
                background: QR_BG,
                borderRadius: "var(--radius-card)",
                padding: "var(--space-4)",
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
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-qr-overlay)", borderRadius: "var(--radius-card)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-bg-base)" }}>
                    Tap or hover to reveal
                  </span>
                </div>
              )}
            </div>

            <IdentityDisplay identity={identity} style={{ textAlign: "center", maxWidth: 300 }} />

            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-6)",
                background: copied ? "var(--color-status-success)" : "var(--color-bg-surface)",
                border: `1px solid ${copied ? "var(--color-status-success)" : "var(--color-border-strong)"}`,
                borderRadius: "var(--radius-pill)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {copied ? (
                <>
                  <CheckCircle size={16} weight="Bold" style={{ color: "var(--color-bg-base)" }} />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-bg-base)" }}>
                    Copied!
                  </span>
                </>
              ) : (
                <>
                  <Copy size={16} weight="Linear" style={{ color: "var(--color-text-primary)" }} />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    Copy address
                  </span>
                </>
              )}
            </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
                No account selected
              </span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
                Select an account from the dashboard to view your receive address
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </AppShell>
  );
}
