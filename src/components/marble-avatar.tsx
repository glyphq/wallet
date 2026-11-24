import Avatar from "boring-avatars";

const MARBLE_COLORS = ["#ccfcfb", "#7dd3fc", "#6ee7b7", "#fbbf24", "#a78bfa", "#f87171"];

export interface MarbleAvatarProps {
  seed: string;
  size: number;
  square?: boolean;
}

/** Deterministic generated marble avatar. */
export function MarbleAvatar({ seed, size, square = true }: MarbleAvatarProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: Math.max(4, Math.round(size * 0.3)),
        overflow: "hidden",
        lineHeight: 0,
        background: "var(--color-bg-surface-2)",
      }}
    >
      <Avatar size={size} name={seed} variant="marble" colors={MARBLE_COLORS} square={square} />
    </span>
  );
}
