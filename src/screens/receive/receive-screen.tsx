import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AltArrowLeft } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { IdentityDisplay } from "@/components/identity-display";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getVaultAccountIdentity } from "@/lib/accounts";

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

  const header = (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "0 var(--space-4)" }}>
      <button type="button" onClick={() => navigate("/dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary)", padding: "var(--space-2) 0", display: "flex", alignItems: "center" }}>
        <AltArrowLeft size={20} />
      </button>
      <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", whiteSpace: "nowrap" }}>
        Your address
      </span>
      <button type="button" onClick={() => navigate("/payment-link")}
        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-secondary)", padding: "var(--space-2) 0" }}>
        Payment link
      </button>
    </div>
  );

  return (
    <AppShell statusBar={header} fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%" }}>
      <motion.div
        initial={{ y: 4 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: "var(--space-6)" }}
      >
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
          {accountName}
        </span>

        {identity ? (
          <>
            <div
              role={hideBalances ? "button" : undefined}
              tabIndex={hideBalances ? 0 : undefined}
              aria-label={hideBalances ? (qrRevealed ? "Hide QR code" : "Reveal QR code") : undefined}
              style={{
                background: "#FFFFFF",
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
                size={200}
                bgColor="#FFFFFF"
                fgColor="#111111"
                level="M"
                aria-label={`QR code for address ${identity}`}
                role="img"
                includeMargin
                style={{ display: "block", filter: hideBalances && !qrRevealed ? "blur(12px)" : "none", transition: "filter 0.15s ease" }}
              />
              {hideBalances && !qrRevealed && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", borderRadius: "var(--radius-card)" }}>
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
      </motion.div>
    </AppShell>
  );
}
