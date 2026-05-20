import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { DONATION_IDENTITY, SPONSORS, type Sponsor } from "@/data/sponsors";

const GITHUB_URL = "https://github.com/sigil-oss/sigil.app";

const MIN_PX = 36;
const MAX_PX = 88;

function blockSize(amount: number, max: number): number {
  if (max === 0) return MIN_PX;
  return Math.round(MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt(amount / max));
}

function formatQu(n: number): string {
  return n.toLocaleString();
}

function SponsorGrid({ sponsors }: { sponsors: Sponsor[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...sponsors.map((s) => s.amount), 1);

  if (sponsors.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
        <div
          style={{
            width: MIN_PX,
            height: MIN_PX,
            border: "1px dashed var(--color-border-strong)",
            borderRadius: "var(--radius-sharp)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>?</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
          [BE THE FIRST]
        </span>
      </div>
    );
  }

  const active = selected !== null ? sponsors[selected] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-5)" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          justifyContent: "center",
          alignItems: "flex-end",
        }}
      >
        {sponsors.map((sponsor, i) => {
          const size = blockSize(sponsor.amount, max);
          const isSelected = selected === i;
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.2, ease: "easeOut" }}
              onClick={() => setSelected(isSelected ? null : i)}
              aria-label={`Sponsor: ${sponsor.name}`}
              style={{
                width: size,
                height: size,
                background: isSelected ? "var(--color-text-display)" : "var(--color-bg-elevated)",
                border: `1px solid ${isSelected ? "var(--color-text-display)" : "var(--color-border-strong)"}`,
                borderRadius: "var(--radius-sharp)",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 0.12s ease, border-color 0.12s ease",
              }}
            />
          );
        })}
      </div>

      <div style={{ minHeight: 36, textAlign: "center" }}>
        {active ? (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
          >
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
              {active.name}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
              {formatQu(active.amount)} QU
            </span>
          </motion.div>
        ) : (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
            TAP A BLOCK
          </span>
        )}
      </div>
    </div>
  );
}

export default function SupportScreen() {
  const navigate = useNavigate();
  useAutoLock();

  const statusBar = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={() => navigate("/settings")}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0 }}
      >
        ← BACK
      </button>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Support
      </span>
      <span style={{ width: 40 }} />
    </div>
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>

      {/* Donation */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
            Support Sigil
          </div>
          <div style={{ marginTop: "var(--space-1)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
            Send QU to support the project. Sponsors are featured below.
          </div>
        </div>

        <div
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-sharp)",
            padding: "var(--space-4)",
          }}
        >
          <QRCodeSVG
            value={DONATION_IDENTITY}
            size={160}
            bgColor="transparent"
            fgColor="var(--color-text-display)"
            level="M"
            aria-label="Donation QR code"
            role="img"
            style={{ display: "block" }}
          />
        </div>

        <button
          onClick={() => navigator.clipboard.writeText(DONATION_IDENTITY).catch(() => {})}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          aria-label="Copy donation identity"
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", wordBreak: "break-all", textAlign: "center", display: "block" }}>
            {DONATION_IDENTITY.slice(0, 10)}...{DONATION_IDENTITY.slice(-10)}
          </span>
        </button>

        <Button onClick={() => navigate(`/send?to=${DONATION_IDENTITY}`)}>
          Send support →
        </Button>
      </div>

      {/* Sponsors */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
            SPONSORS
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--color-border-subtle)" }} />
        </div>

        <SponsorGrid sponsors={SPONSORS} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", marginTop: "auto" }}>
        <button
          onClick={() => openUrl(GITHUB_URL).catch(() => {})}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
            ★ STAR ON GITHUB
          </span>
        </button>
      </div>

    </AppShell>
  );
}
