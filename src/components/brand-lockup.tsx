import glyphOnDark from "@/assets/brand/glyph-on-dark.png";

interface BrandLockupProps {
  size?: number;
  title?: string;
  subtitle?: string;
  align?: "left" | "center";
  compact?: boolean;
}

export function BrandLockup({
  size = 40,
  title = "Glyph Wallet",
  subtitle,
  align = "left",
  compact = false,
}: BrandLockupProps) {
  const centered = align === "center";

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
        src={glyphOnDark}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        style={{ borderRadius: "var(--radius-surface)", flexShrink: 0 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
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
      </div>
    </div>
  );
}
