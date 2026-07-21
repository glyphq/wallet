import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { LinkRound } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellVaultSwitcher } from "@/components/shell-vault-switcher";
import { IdentityDisplay } from "@/components/identity-display";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getVaultAccountIdentity } from "@/lib/accounts";


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
  const hideBalances = settings.hideBalances;
  const [qrRevealed, setQrRevealed] = useState(false);


  const header = useMemo(() => (
    <ScreenHeader
      leading={<ShellVaultSwitcher />}
      title="Receive"
      action={
        <IconButton label="Create payment link" onClick={() => navigate("/payment-link")}>
          <LinkRound size={20} aria-hidden="true" />
        </IconButton>
      }
    />
  ), [navigate]);

  return (
    <AppShell
      fullBleed
      statusBar={header}
      contentStyle={{ padding: "var(--space-4)", height: "100%" }}
    >
      <motion.div
        {...stepMotion}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-5)" }}
      >
        <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-5)" }}>
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
