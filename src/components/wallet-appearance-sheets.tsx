import type { CSSProperties } from "react";
import { CheckmarkCircle01Icon } from "@/lib/icons";
import { Sheet } from "@/components/sheet";
import { WALLET_COLOR_OPTIONS, WALLET_ICON_OPTIONS } from "@/lib/wallet-appearance";
import type { VaultColor, WalletIconId } from "@/store/persisted";

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

export interface VaultIconPickerSheetProps {
  open: boolean;
  icon: WalletIconId;
  accent: string;
  onSelect: (icon: WalletIconId) => void;
  onClose: () => void;
}

export function VaultIconPickerSheet({ open, icon, accent, onSelect, onClose }: VaultIconPickerSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Choose Vault icon">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {WALLET_ICON_OPTIONS.map((option) => {
          const OptionIcon = option.Icon;
          const selected = option.id === icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onSelect(option.id);
                onClose();
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
                  <OptionIcon size={18} strokeWidth={selected ? 2 : 1.5} aria-hidden="true" />
                </div>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)" }}>{option.label}</span>
              </div>
              {selected ? <CheckmarkCircle01Icon size={18} strokeWidth={2} aria-hidden="true" style={{ color: accent, flexShrink: 0 }} /> : null}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export interface VaultAccentPickerSheetProps {
  open: boolean;
  color: VaultColor;
  onSelect: (color: VaultColor) => void;
  onClose: () => void;
}

export function VaultAccentPickerSheet({ open, color, onSelect, onClose }: VaultAccentPickerSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Choose accent color">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {WALLET_COLOR_OPTIONS.map((option) => {
          const selected = option.id === color;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onSelect(option.id);
                onClose();
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
              {selected ? <CheckmarkCircle01Icon size={18} strokeWidth={2} aria-hidden="true" style={{ color: option.accent, flexShrink: 0 }} /> : null}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
