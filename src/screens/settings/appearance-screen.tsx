import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePersistedStore, type ThemeMode, type FontPairId } from "@/store/persisted";
import { FONT_PAIRS } from "@/lib/appearance";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { Sun, Moon } from "@solar-icons/react";

const THEMES: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "light", label: "Light", Icon: Sun },
];

function SettingsSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-caption)",
      fontWeight: 600,
      color: "var(--color-text-disabled)",
      letterSpacing: "0.06em",
    }}>
      {children}
    </span>
  );
}

function SettingsDivider() {
  return <div style={{ height: 1, background: "var(--color-border-subtle)" }} />;
}

function FontPicker({ value, onChange }: { value: FontPairId; onChange: (font: FontPairId) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedFont = FONT_PAIRS.find((pair) => pair.id === value) ?? FONT_PAIRS[0];

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", flex: "0 1 190px" }}>
      <button
        type="button"
        className="settings-pressable"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="interface-font-options"
        onClick={() => setOpen((current) => !current)}
        style={{
          width: "100%",
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          padding: "0 var(--space-3)",
          background: "var(--color-bg-input)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "var(--radius-control)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
          fontFamily: selectedFont.sans,
          fontSize: "var(--text-label)",
          textAlign: "left",
        }}
      >
        <span>{selectedFont.name}</span>
        <span aria-hidden="true" style={{ color: "var(--color-text-tertiary)", fontFamily: "var(--font-sans)" }}>▾</span>
      </button>

      {open && (
        <div
          id="interface-font-options"
          role="listbox"
          aria-label="Interface font"
          style={{
            position: "absolute",
            zIndex: 2,
            top: "calc(100% + var(--space-1))",
            right: 0,
            width: "max-content",
            minWidth: "100%",
            overflow: "hidden",
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-control)",
            boxShadow: "var(--shadow-floating)",
          }}
        >
          {FONT_PAIRS.map((pair, index) => (
            <div key={pair.id}>
              {index > 0 && <SettingsDivider />}
              <button
                type="button"
                className="settings-pressable"
                role="option"
                aria-selected={pair.id === value}
                onClick={() => {
                  onChange(pair.id);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-4)",
                  padding: "var(--space-2) var(--space-3)",
                  background: pair.id === value ? "var(--color-bg-hover)" : "none",
                  border: "none",
                  color: pair.id === value ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  cursor: "pointer",
                  fontFamily: pair.sans,
                  fontSize: "var(--text-label)",
                  fontWeight: pair.id === value ? 600 : 400,
                  textAlign: "left",
                }}
              >
                <span>{pair.name}</span>
                {pair.id === value && (
                  <span aria-hidden="true" style={{ color: "var(--color-accent)", fontFamily: "var(--font-sans)" }}>Selected</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppearanceScreen() {
  const themeMode = usePersistedStore((s) => s.settings.themeMode);
  const fontPair = usePersistedStore((s) => s.settings.fontPair);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", minHeight: 0 }}>
        <SettingsPageHeader title="Appearance" />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <SettingsSectionLabel>Theme</SettingsSectionLabel>
          <div role="radiogroup" aria-label="Theme" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {THEMES.map(({ id, label, Icon }, index) => {
              const selected = themeMode === id;
              return (
                <div key={id}>
                  {index > 0 && <SettingsDivider />}
                  <button
                    type="button"
                    className="settings-pressable"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateSettings({ themeMode: id })}
                    style={{
                      width: "100%",
                      minHeight: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      padding: "var(--space-2) var(--space-3)",
                      background: selected ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
                      border: "1px solid var(--color-border-subtle)",
                      borderRadius: "var(--radius-control)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                      fontWeight: selected ? 600 : 400,
                      color: selected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Icon size={16} weight="Linear" aria-hidden="true" />
                      {label}
                    </span>
                    <span style={{ fontSize: "var(--text-caption)", color: selected ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}>
                      {selected ? "Selected" : ""}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <SettingsDivider />

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <SettingsSectionLabel>Font</SettingsSectionLabel>
          <div style={{ display: "flex" }}>
            <FontPicker value={fontPair} onChange={(font) => updateSettings({ fontPair: font })} />
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
