import glyphOnDark from "@/assets/brand/glyph-on-dark.png";
import glyphOnLight from "@/assets/brand/glyph-on-light.png";
import { usePersistedStore } from "@/store/persisted";

interface BrandLockupProps {
  size?: number;
  title?: string;
  subtitle?: string;
  align?: "left" | "center";
  compact?: boolean;
  iconOnly?: boolean;
}

export function BrandLockup({
  size = 40,
  title = "Glyph Wallet",
  subtitle,
  align = "left",
  compact = false,
  iconOnly = false,
}: BrandLockupProps) {
  const centered = align === "center";
  const themeMode = usePersistedStore((state) => state.settings.themeMode);
  const logo = themeMode === "light" ? glyphOnLight : glyphOnDark;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: centered ? "center" : "flex-start",
        gap: compact ? "var(--space-3)" : "var(--space-4)",
        textAlign: centered ? "center" : "left",
      }}
    >
      <img
        src={logo}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      />
      {!iconOnly ? <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: compact ? "var(--text-section)" : "var(--text-title)",
            lineHeight: "var(--leading-tight)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-caption)",
              lineHeight: "var(--leading-compact)",
              color: "var(--color-text-tertiary)",
            }}
          >
            {subtitle}
          </span>
        ) : null}
      </div> : null}
    </div>
  );
}
