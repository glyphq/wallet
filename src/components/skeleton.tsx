import type { CSSProperties } from "react";

/** Neutral loading placeholder. No glyphs, shimmer, or layout-shifting text. */
export function Skeleton({
  width = "100%",
  height = 10,
  circle = false,
  style,
}: {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  circle?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height,
        flexShrink: 0,
        borderRadius: circle ? "50%" : "var(--radius-sharp)",
        background: "var(--color-skeleton)",
        ...style,
      }}
    />
  );
}
