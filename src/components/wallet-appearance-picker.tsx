import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown01Icon } from "@/lib/icons";
import { WALLET_COLOR_OPTIONS, getWalletAccent, getWalletIconComponent, getWalletIconLabel } from "@/lib/wallet-appearance";
import { VaultAccentPickerSheet, VaultIconPickerSheet } from "@/components/wallet-appearance-sheets";
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
          <ArrowDown01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
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
            <span style={labelStyle}>Vault appearance</span>
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
            <PreviewIcon size={22} strokeWidth={2} aria-hidden="true" />
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
              <PreviewIcon size={18} strokeWidth={2} aria-hidden="true" />
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

      <VaultIconPickerSheet
        open={iconSheetOpen}
        icon={icon}
        accent={accent}
        onSelect={onIconChange}
        onClose={() => setIconSheetOpen(false)}
      />

      <VaultAccentPickerSheet
        open={colorSheetOpen}
        color={color}
        onSelect={onColorChange}
        onClose={() => setColorSheetOpen(false)}
      />
    </>
  );
}
