import type { CSSProperties, ReactNode } from "react";
import type { VaultColor, WalletIconId } from "@/store/persisted";
import { CONTACT_ICON, CONTRACT_ICON, DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON, PERSONA_ICON, getWalletAccent, getWalletIconComponent } from "@/lib/wallet-appearance";

type BadgeKind = "vault" | "account" | "contract" | "contact" | "identity" | "position";

interface IdenticonProps {
  seed: string;
  size?: number;
  radius?: number;
  padding?: number;
  style?: CSSProperties;
  label?: string;
  kind?: BadgeKind;
  code?: string;
  icon?: ReactNode;
  walletIcon?: WalletIconId;
  vaultColor?: VaultColor;
}

function badgeLabel(seed: string, explicitLabel?: string): string {
  const source = (explicitLabel?.trim() || seed).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!source) return "•";
  return source.slice(0, source.length > 1 ? 2 : 1);
}

function accountCode(label?: string, code?: string) {
  if (code?.trim()) return code.trim().toUpperCase();
  const match = label?.match(/(\d+)/);
  if (match) return `A${match[1]}`;
  return "AC";
}

const SURFACE_BY_KIND: Record<BadgeKind, { background: string; border: string; color: string }> = {
  vault: {
    background: "var(--color-bg-subtle)",
    border: "var(--color-border-default)",
    color: "var(--color-text-primary)",
  },
  account: {
    background: "var(--color-bg-inset)",
    border: "var(--color-border-subtle)",
    color: "var(--color-text-secondary)",
  },
  contract: {
    background: "var(--color-bg-surface-2)",
    border: "var(--color-border-default)",
    color: "var(--color-text-primary)",
  },
  contact: {
    background: "var(--color-bg-surface)",
    border: "var(--color-border-subtle)",
    color: "var(--color-text-secondary)",
  },
  identity: {
    background: "var(--color-bg-subtle)",
    border: "var(--color-border-subtle)",
    color: "var(--color-text-secondary)",
  },
  position: {
    background: "var(--color-bg-surface-2)",
    border: "var(--color-border-default)",
    color: "var(--color-text-primary)",
  },
};

export function Identicon({
  seed,
  size = 32,
  radius = 4,
  padding = 2,
  style,
  label,
  kind = "identity",
  code,
  icon,
  walletIcon,
  vaultColor,
}: IdenticonProps) {
  const text = kind === "account" ? accountCode(label, code) : badgeLabel(seed, label);
  const fontSize = Math.max(10, Math.floor((size - padding * 2) * 0.34));
  const surface = SURFACE_BY_KIND[kind];
  const innerSize = Math.max(12, size - padding * 2);

  if (kind === "vault") {
    const WalletGlyph = getWalletIconComponent(walletIcon ?? DEFAULT_WALLET_ICON);
    const accent = getWalletAccent(vaultColor ?? DEFAULT_WALLET_COLOR);
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: `color-mix(in srgb, ${accent} 16%, var(--color-bg-subtle))`,
          border: `1px solid color-mix(in srgb, ${accent} 46%, var(--color-border-default))`,
          color: accent,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 22%, transparent)`,
          ...style,
        }}
      >
        <WalletGlyph size={Math.max(12, Math.floor(innerSize * 0.58))} weight="BoldDuotone" aria-hidden="true" />
      </div>
    );
  }

  if (kind === "identity") {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: surface.background,
          border: `1px solid ${surface.border}`,
          color: surface.color,
          ...style,
        }}
      >
        <PERSONA_ICON size={Math.max(12, Math.floor(innerSize * 0.58))} weight="BoldDuotone" aria-hidden="true" />
      </div>
    );
  }

  if (kind === "contact") {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: surface.background,
          border: `1px solid ${surface.border}`,
          color: surface.color,
          ...style,
        }}
      >
        <CONTACT_ICON size={Math.max(12, Math.floor(innerSize * 0.56))} weight="BoldDuotone" aria-hidden="true" />
      </div>
    );
  }

  if (kind === "contract" && !icon) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: surface.background,
          border: `1px solid ${surface.border}`,
          color: surface.color,
          ...style,
        }}
      >
        <CONTRACT_ICON size={Math.max(12, Math.floor(innerSize * 0.56))} weight="BoldDuotone" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: surface.background,
        border: `1px solid ${surface.border}`,
        color: surface.color,
        fontFamily: "var(--font-mono)",
        fontSize,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {icon ?? text}
    </div>
  );
}
