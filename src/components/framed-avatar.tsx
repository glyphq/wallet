import { MarbleAvatar } from "@/components/marble-avatar";

/** Marble avatar inside the same square frame used by account and wallet icons. */
export function FramedAvatar({ seed, size = 30 }: { seed: string; size?: number }) {
  const inner = Math.max(12, size - 6);
  return (
    <span
      aria-hidden="true"
      className="avatar-frame corner-frame"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        padding: 2,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 2,
        background: "var(--color-bg-surface)",
      }}
    >
      <MarbleAvatar seed={seed} size={inner} />
    </span>
  );
}
