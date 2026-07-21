import { useState, type CSSProperties, type ReactNode } from "react";
import { AltArrowDown, CheckCircle } from "@solar-icons/react";
import { Sheet } from "@/components/sheet";
import { WALLET_COLOR_OPTIONS, WALLET_ICON_OPTIONS, getWalletAccent, getWalletIconComponent, getWalletIconLabel } from "@/lib/wallet-appearance";
import type { VaultColor, WalletIconId } from "@/store/persisted";

interface WalletAppearancePickerProps {
  icon: WalletIconId;
  color: VaultColor;
  onIconChange: (icon: WalletIconId) => void;
  onColorChange: (color: VaultColor) => void;
  style?: CSSProperties;
}

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  color: "var(--color-text-tertiary)",
};

const selectorButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  padding: "var(--space-2) var(--space-3)",
  borderRadius: "var(--radius-pill)",
  border: "1px solid var(--color-border-default)",
  background: "var(--color-bg-surface-2)",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  textAlign: "left",
};

const optionButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-3)",
  padding: "var(--space-2) 0",
  border: "none",
  background: "transparent",
  color: "var(--color-text-primary)",
  cursor: "pointer",
  textAlign: "left",
};

function SelectorField({
  label,
  title,
  leading,
  trailing,
  onClick,
}: {
  label: string;
  title: string;
  leading: ReactNode;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={labelStyle}>{label}</span>
      <button type="button" onClick={onClick} style={selectorButtonStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
          {leading}
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", minWidth: 0 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0, color: "var(--color-text-secondary)" }}>
          {trailing}
          <AltArrowDown size={16} weight="Outline" aria-hidden="true" />
        </div>
      </button>
    </div>
  );
}

export function WalletAppearancePicker({ icon, color, onIconChange, onColorChange, style }: WalletAppearancePickerProps) {
  const [iconSheetOpen, setIconSheetOpen] = useState(false);
  const [colorSheetOpen, setColorSheetOpen] = useState(false);
  const PreviewIcon = getWalletIconComponent(icon);
  const accent = getWalletAccent(color);
  const iconLabel = getWalletIconLabel(icon);
  const colorOption = WALLET_COLOR_OPTIONS.find((option) => option.id === color) ?? WALLET_COLOR_OPTIONS[0];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", ...style }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={labelStyle}>Wallet appearance</span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-primary)" }}>
              {iconLabel} in {colorOption.label.toLowerCase()}
            </span>
          </div>

          <div
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: "var(--radius-pill)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: `color-mix(in srgb, ${accent} 18%, var(--color-bg-surface-2))`,
              border: `1px solid color-mix(in srgb, ${accent} 52%, var(--color-border-default))`,
              color: accent,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 20%, transparent)`,
            }}
          >
            <PreviewIcon size={22} weight="BoldDuotone" aria-hidden="true" />
          </div>
        </div>

        <SelectorField
          label="Icon"
          title={iconLabel}
          onClick={() => setIconSheetOpen(true)}
          leading={
            <div
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: "var(--radius-pill)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: `color-mix(in srgb, ${accent} 14%, var(--color-bg-surface-1))`,
                color: accent,
              }}
            >
              <PreviewIcon size={18} weight="BoldDuotone" aria-hidden="true" />
            </div>
          }
        />

        <SelectorField
          label="Accent"
          title={colorOption.label}
          onClick={() => setColorSheetOpen(true)}
          leading={
            <div
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                borderRadius: 999,
                background: colorOption.accent,
                border: "1px solid color-mix(in srgb, var(--color-text-primary) 18%, transparent)",
              }}
            />
          }
        />
      </div>

      <Sheet open={iconSheetOpen} onClose={() => setIconSheetOpen(false)} title="Choose wallet icon">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {WALLET_ICON_OPTIONS.map((option) => {
            const OptionIcon = option.Icon;
            const selected = option.id === icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onIconChange(option.id);
                  setIconSheetOpen(false);
                }}
                style={optionButtonStyle}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: "var(--radius-pill)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: selected ? `color-mix(in srgb, ${accent} 14%, var(--color-bg-surface-1))` : "var(--color-bg-surface-1)",
                      color: selected ? accent : "var(--color-text-secondary)",
                    }}
                  >
                    <OptionIcon size={18} weight={selected ? "BoldDuotone" : "Linear"} aria-hidden="true" />
                  </div>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)" }}>{option.label}</span>
                </div>
                {selected ? <CheckCircle size={18} weight="Bold" aria-hidden="true" style={{ color: accent, flexShrink: 0 }} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={colorSheetOpen} onClose={() => setColorSheetOpen(false)} title="Choose accent color">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {WALLET_COLOR_OPTIONS.map((option) => {
            const selected = option.id === color;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onColorChange(option.id);
                  setColorSheetOpen(false);
                }}
                style={optionButtonStyle}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 24,
                      height: 24,
                      flexShrink: 0,
                      borderRadius: 999,
                      background: option.accent,
                      border: "1px solid color-mix(in srgb, var(--color-text-primary) 18%, transparent)",
                    }}
                  />
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)" }}>{option.label}</span>
                </div>
                {selected ? <CheckCircle size={18} weight="Bold" aria-hidden="true" style={{ color: option.accent, flexShrink: 0 }} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
