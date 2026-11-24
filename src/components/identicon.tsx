import type { CSSProperties, ReactNode } from "react";
import Avatar from "boring-avatars";
import { FlashIcon } from "@/lib/icons";
import type { WalletColor, WalletIconId } from "@/store/persisted";
import { CONTACT_ICON } from "@/lib/wallet-appearance";

const MARBLE_COLORS = ["#ccfcfb", "#7dd3fc", "#6ee7b7", "#fbbf24", "#a78bfa", "#f87171"];
const ASCII_TEXTURE_CHARS = "/\\|_-=+*#%@";

function asciiTexture(seed: string, size: number): { text: string; fontSize: number; lineHeight: number } {
  const columns = Math.max(5, Math.floor(size / 7));
  const rows = Math.max(5, Math.floor(size / 7));
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let column = 0; column < columns; column++) {
      const value = next();
      line += value % 100 < 35 ? " " : ASCII_TEXTURE_CHARS[value % ASCII_TEXTURE_CHARS.length];
    }
    lines.push(line);
  }
  return { text: lines.join("\n"), fontSize: size / columns, lineHeight: size / rows };
}

function AsciiAvatarTexture({ seed, size }: { seed: string; size: number }) {
  const { text, fontSize, lineHeight } = asciiTexture(seed, size);
  return (
    <pre
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        margin: 0,
        padding: 0,
        overflow: "hidden",
        fontFamily: "var(--font-mono)",
        fontSize,
        lineHeight: `${lineHeight}px`,
        letterSpacing: 0,
        color: "#111",
        opacity: 0.3,
        mixBlendMode: "multiply",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {text}
    </pre>
  );
}

type BadgeKind = "wallet" | "account" | "contract" | "contact" | "identity" | "position";

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
  walletColor?: WalletColor;
  square?: boolean;
  /** Overlay a deterministic ASCII dither texture on generated avatars. */
  ascii?: boolean;
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
  wallet: {
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
  walletIcon: _walletIcon,
  walletColor: _walletColor,
  square = false,
  ascii = false,
}: IdenticonProps) {
  const text = kind === "account" ? accountCode(label, code) : badgeLabel(seed, label);
  const fontSize = Math.max(10, Math.floor((size - padding * 2) * 0.34));
  const surface = SURFACE_BY_KIND[kind];
  const innerSize = Math.max(12, size - padding * 2);

  if (kind === "wallet") {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          position: "relative",
          borderRadius: radius,
          overflow: "hidden",
          flexShrink: 0,
          ...style,
        }}
      >
        <Avatar
          size={size}
          name={seed}
          variant="marble"
          colors={MARBLE_COLORS}
          square={square}
        />
        {ascii ? <AsciiAvatarTexture seed={seed} size={size} /> : null}
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
          position: "relative",
          borderRadius: radius,
          overflow: "hidden",
          flexShrink: 0,
          ...style,
        }}
      >
        <Avatar
          size={size}
          name={seed}
          variant="marble"
          colors={MARBLE_COLORS}
          square={square}
        />
        {ascii ? <AsciiAvatarTexture seed={seed} size={size} /> : null}
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
        <CONTACT_ICON size={Math.max(12, Math.floor(innerSize * 0.56))} strokeWidth={2} aria-hidden="true" />
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
        <FlashIcon size={Math.max(12, Math.floor(innerSize * 0.56))} strokeWidth={2} aria-hidden="true" />
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
