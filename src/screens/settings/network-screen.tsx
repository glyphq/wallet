import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { usePersistedStore } from "@/store/persisted";

const TICK_PRESETS = [5, 10, 15, 20, 30, 50] as const;
const MAX_TICK_OFFSET = 60;

const sectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
} as const;

const helperStyle = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-caption)",
  color: "var(--color-text-secondary)",
} as const;

export default function NetworkScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  const [customOffsetOpen, setCustomOffsetOpen] = useState(false);
  const [customOffset, setCustomOffset] = useState("");
  const [customOffsetError, setCustomOffsetError] = useState("");

  const customTickOffset = !TICK_PRESETS.some((value) => value === settings.tickOffset);

  function chooseTickOffset(offset: number) {
    updateSettings({ tickOffset: offset });
    setCustomOffsetOpen(false);
    setCustomOffsetError("");
  }

  function openCustomTickOffset() {
    setCustomOffsetOpen(true);
    setCustomOffsetError("");
    setCustomOffset(String(settings.tickOffset));
  }

  function applyCustomTickOffset() {
    const offset = Number.parseInt(customOffset, 10);
    if (!Number.isFinite(offset) || offset < 1 || offset > MAX_TICK_OFFSET) {
      setCustomOffsetError(`Enter 1–${MAX_TICK_OFFSET} ticks.`);
      return;
    }
    chooseTickOffset(offset);
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Network" />

        <section style={sectionStyle} aria-label="Glyph API">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <SettingsSectionLabel>Glyph API</SettingsSectionLabel>
            <span style={helperStyle}>
              Fixed endpoint for all chain reads and broadcasts.
            </span>
          </div>
          <div
            className="settings-menu corner-frame"
            style={{ padding: "var(--space-3) var(--space-4)" }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-mono-sm)",
                color: "var(--color-text-secondary)",
                overflowWrap: "anywhere",
              }}
            >
              {settings.network.apiUrl}
            </span>
          </div>
        </section>

        <SettingsDivider fullBleed />

        <section style={sectionStyle} aria-label="Transaction tick offset">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <SettingsSectionLabel>Transaction tick offset</SettingsSectionLabel>
            <span style={helperStyle}>
              Target tick = current + offset. Higher values give more time to confirm.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {TICK_PRESETS.map((value) => (
              <Button
                key={value}
                size="sm"
                variant={value === settings.tickOffset ? "primary" : "secondary"}
                style={{ width: "auto" }}
                onClick={() => chooseTickOffset(value)}
                aria-pressed={value === settings.tickOffset}
              >
                +{value}
              </Button>
            ))}
            <Button
              size="sm"
              variant={customTickOffset || customOffsetOpen ? "primary" : "secondary"}
              style={{ width: "auto" }}
              aria-pressed={customTickOffset}
              aria-expanded={customOffsetOpen}
              onClick={openCustomTickOffset}
            >
              {customTickOffset ? `Custom · +${settings.tickOffset}` : "Custom"}
            </Button>
          </div>
          {customOffsetOpen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxWidth: 260 }}>
              <Input
                label="Custom offset (ticks)"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={customOffset}
                onChange={(event) => {
                  setCustomOffset(event.target.value.replace(/\D/g, ""));
                  setCustomOffsetError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCustomTickOffset();
                  }
                }}
                error={customOffsetError || undefined}
              />
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button size="sm" onClick={applyCustomTickOffset}>Apply</Button>
                <Button size="sm" variant="ghost" onClick={() => { setCustomOffsetOpen(false); setCustomOffsetError(""); }}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </section>
      </motion.div>
    </AppShell>
  );
}
