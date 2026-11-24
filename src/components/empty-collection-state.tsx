import type { CSSProperties } from "react";
import { Hub, Loupe, Plot, Relay } from "@lucasmarkes/hairline/react";

const FIGURE_STYLE = {
  width: 180,
  pointerEvents: "none",
  "--hairline-plate": "transparent",
  "--hairline-hi": "var(--color-text-primary)",
  "--hairline-edge": "var(--color-text-tertiary)",
  "--hairline-mid": "var(--color-border-strong)",
  "--hairline-lo": "var(--color-border-subtle)",
  "--hairline-stroke": "0.8px",
} as CSSProperties;

/** Shared hairline empty state for collection screens. */
export function EmptyCollectionState({
  title,
  description,
  icon = "activity",
}: {
  title: string;
  description: string;
  icon?: "activity" | "search" | "contacts" | "apps";
}) {
  const Figure = icon === "search" ? Loupe : icon === "contacts" ? Hub : icon === "apps" ? Relay : Plot;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-6) var(--space-4)",
        textAlign: "center",
      }}
    >
      <Figure aria-hidden="true" intensity={0.35} style={FIGURE_STYLE} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-compact)",
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </span>
        <span
          style={{
            maxWidth: 280,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-body)",
            color: "var(--color-text-tertiary)",
          }}
        >
          {description}
        </span>
      </div>
    </div>
  );
}
