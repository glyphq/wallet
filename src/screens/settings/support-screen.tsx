import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { DONATION_IDENTITY, type Sponsor, type SponsorDonation } from "@/data/sponsors";
import { useSponsors, useInvalidateSponsors } from "@/hooks/use-sponsors";
import { usePersistedStore } from "@/store/persisted";
import { formatDate, formatQu, truncateId } from "@/lib/format";

const GITHUB_URL = "https://github.com/glyph-oss/glyph.app";

const MIN_PX = 36;
const MAX_PX = 88;

function blockSize(amount: bigint, max: bigint): number {
  if (max <= 0n) return MIN_PX;
  const ratio = Number((amount * 10_000n) / max) / 10_000;
  return Math.round(MIN_PX + (MAX_PX - MIN_PX) * Math.sqrt(Math.max(0, ratio)));
}

// ── Identicon (GitHub / Raycast style, FNV-1a) ───────────────────────────────

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

// 5×5 grid, horizontally mirrored — 15 bits from the hash
function buildIdenticon(name: string): boolean[][] {
  const hash = fnv1a(name);
  return Array.from({ length: 5 }, (_, row) =>
    [0, 1, 2, 1, 0].map((col) => ((hash >>> (row * 3 + col)) & 1) === 1)
  );
}

function Identicon({ name, size, invert = false }: { name: string; size: number; invert?: boolean }) {
  const grid = buildIdenticon(name);
  const color = invert ? "var(--color-bg-base)" : "var(--color-text-display)";
  // 10px margin each side → 80px grid → 16px per cell → 13px cell, 3px gap
  const margin = 10, spacing = 16, cell = 13, radius = 2.5;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }} aria-hidden>
      {grid.map((row, ri) =>
        row.map((filled, ci) =>
          filled ? (
            <rect
              key={`${ri}-${ci}`}
              x={margin + ci * spacing}
              y={margin + ri * spacing}
              width={cell}
              height={cell}
              rx={radius}
              fill={color}
            />
          ) : null
        )
      )}
    </svg>
  );
}

// ── Sponsor detail sheet ──────────────────────────────────────────────────────

function SponsorSheet({ sponsor, onClose }: { sponsor: Sponsor; onClose: () => void }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50 }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "85dvh",
          overflowY: "auto",
          background: "var(--color-bg-base)",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          borderTop: "1px solid var(--color-border-strong)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "var(--space-4) var(--space-6) var(--space-8)",
          gap: "var(--space-5)",
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 3, background: "var(--color-border-strong)", borderRadius: 2, flexShrink: 0 }} />

        {/* Identicon */}
        <div style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-5)",
        }}>
          <Identicon name={sponsor.name} size={120} />
        </div>

        {/* Info */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-2)", width: "100%", overflowWrap: "break-word" }}>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-headline)",
            color: "var(--color-text-display)",
            wordBreak: "break-word",
          }}>
            {sponsor.name}
          </span>
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label)",
            color: "var(--color-text-secondary)",
          }}>
            {formatQu(sponsor.amount)} QU
          </span>
        </div>

        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "var(--space-2)" }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
            Close
          </span>
        </button>
      </motion.div>
    </>
  );
}

// ── Sponsor grid ──────────────────────────────────────────────────────────────

function SponsorGrid({ sponsors }: { sponsors: Sponsor[] }) {
  const [selected, setSelected] = useState<Sponsor | null>(null);
  const max = sponsors.reduce((current, sponsor) => (sponsor.amount > current ? sponsor.amount : current), 1n);

  if (sponsors.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
        <div style={{
          width: MIN_PX, height: MIN_PX,
          border: "1px dashed var(--color-border-strong)",
          borderRadius: "var(--radius-card)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>?</span>
        </div>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
          Be the first
        </span>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", justifyContent: "center", alignItems: "flex-end" }}>
        {sponsors.map((sponsor, i) => {
          const size = blockSize(sponsor.amount, max);
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.015, 1.5), duration: 0.2, ease: "easeOut" }}
              onClick={() => setSelected(sponsor)}
              aria-label={`Sponsor: ${sponsor.name}`}
              style={{
                width: size, height: size,
                background: "var(--color-bg-surface)",
                borderRadius: "var(--radius-card)",
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                border: "none",
              }}
            >
              <Identicon name={sponsor.name} size={size} />
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <SponsorSheet sponsor={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Discord prompt sheet ──────────────────────────────────────────────────────

const DISCORD_HANDLE = "alez.t04";

function DiscordSheet({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(DISCORD_HANDLE).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50 }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "85dvh",
          overflowY: "auto",
          background: "var(--color-bg-base)",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          borderTop: "1px solid var(--color-border-strong)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "var(--space-4) var(--space-6) var(--space-8)",
          gap: "var(--space-5)",
        }}
      >
        <div style={{ width: 36, height: 3, background: "var(--color-border-strong)", borderRadius: 2, flexShrink: 0 }} />

        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-headline)",
            color: "var(--color-text-display)",
            fontWeight: 500,
          }}>
            Thank you
          </span>
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label)",
            color: "var(--color-text-secondary)",
            maxWidth: 280,
          }}>
            Message me on Discord to show your name instead of your identity in the sponsors list.
          </span>
        </div>

        <button
          onClick={copy}
          style={{
            background: "var(--color-bg-surface)",
            borderRadius: "var(--radius-card)",
            cursor: "pointer",
            padding: "var(--space-3) var(--space-5)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            border: "none",
          }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-display)" }}>
            @{DISCORD_HANDLE}
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: copied ? "var(--color-accent)" : "var(--color-text-disabled)" }}>
            {copied ? "Copied" : "Copy"}
          </span>
        </button>

        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "var(--space-2)" }}
        >
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
            Close
          </span>
        </button>
      </motion.div>
    </>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SupportScreen() {
  const navigate = useNavigate();

  const { data } = useSponsors();
  const sponsors = data?.sponsors ?? [];
  const latestContributors = data?.latestContributors ?? [];
  const donations = data?.donations ?? [];
  const invalidateSponsors = useInvalidateSponsors();
  const pendingTxs = usePersistedStore((s) => s.pendingTxs);
  const sponsorAttribution = usePersistedStore((s) => s.settings.sponsorAttribution);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const [showDiscord, setShowDiscord] = useState(false);
  const seenHashesRef = useRef<Set<string>>(new Set(pendingTxs.map((t) => t.hash)));

  useEffect(() => {
    for (const tx of pendingTxs) {
      if (seenHashesRef.current.has(tx.hash)) continue;
      seenHashesRef.current.add(tx.hash);
      if (tx.destination === DONATION_IDENTITY) {
        invalidateSponsors();
        setShowDiscord(true);
      }
    }
  }, [pendingTxs]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <AppShell fullBleed contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <motion.div initial={{ y: 4 }} animate={{ y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <SettingsPageHeader title="Support" />

        {/* Donation */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Support Glyph
            </div>
            <div style={{ marginTop: "var(--space-1)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
              Send QU to support the project. Sponsors are featured below.
            </div>
          </div>

          <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
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
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
              {DONATION_IDENTITY.slice(0, 10)}...{DONATION_IDENTITY.slice(-10)}
            </span>
          </button>

          <button
            onClick={() => navigate(`/send?to=${DONATION_IDENTITY}`)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-accent)" }}>
              Send support →
            </span>
          </button>
        </div>

        {/* Attribution controls */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Attribution controls
            </div>
            <div style={{ marginTop: "var(--space-1)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
              Save how you want future support to be represented in Glyph's transparency page.
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {[
              { value: "anonymous", label: "Anonymous" },
              { value: "identity", label: "Show identity" },
              { value: "custom", label: "Custom name" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  updateSettings({ sponsorAttribution: option.value as typeof sponsorAttribution });
                  if (option.value === "custom") setShowDiscord(true);
                }}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: sponsorAttribution === option.value ? "var(--color-accent)" : "transparent",
                  color: sponsorAttribution === option.value ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  fontWeight: 500,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", overflowWrap: "break-word", wordBreak: "break-word" }}>
            {sponsorAttribution === "custom"
              ? "Custom name requires a manual Discord confirmation."
              : sponsorAttribution === "identity"
                ? "Your donor identity will remain visible until a custom name override is added."
                : "Anonymous is a local preference only — send from a separate identity if you need full on-chain privacy."}
          </div>
        </div>

        {/* Sponsors */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
            Sponsors
          </span>

          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <SponsorGrid sponsors={sponsors} />
          </div>

          {latestContributors.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
                Latest contributors
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1) var(--space-3)" }}>
                {latestContributors.map((sponsor) => (
                  <span key={`latest-${sponsor.identity}`} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-primary)" }}>
                    {sponsor.name}
                    <span style={{ color: "var(--color-text-disabled)", marginLeft: "var(--space-1)" }}>
                      {formatQu(sponsor.amount)} QU
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {donations.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
                Donation history
              </span>
              <div style={{ display: "flex", flexDirection: "column", maxHeight: 260, overflowY: "auto" }}>
                {donations.map((donation, i) => (
                  <DonationRow key={donation.hash} donation={donation} sponsorName={sponsors.find((item) => item.identity === donation.source)?.name} showDivider={i < donations.length - 1} />
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => openUrl(GITHUB_URL).catch(() => {})}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, alignSelf: "center" }}
          >
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
              ★ Star on GitHub
            </span>
          </button>
        </div>
      </motion.div>
    </AppShell>
    <AnimatePresence>
      {showDiscord && <DiscordSheet onClose={() => setShowDiscord(false)} />}
    </AnimatePresence>
    </>
  );
}

function DonationRow({ donation, sponsorName, showDivider }: { donation: SponsorDonation; sponsorName?: string; showDivider: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      gap: "var(--space-3)",
      alignItems: "flex-start",
      padding: "var(--space-3) 0",
      borderBottom: showDivider ? "1px solid var(--color-border-subtle)" : "none",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-primary)" }}>
          {sponsorName ?? truncateId(donation.source, 10, 8)}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
          {formatDate(donation.timestamp)}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-primary)", letterSpacing: "0.04em" }}>
          {formatQu(donation.amount)} QU
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", letterSpacing: "0.04em" }}>
          {truncateId(donation.hash, 8, 8)}
        </span>
      </div>
    </div>
  );
}
