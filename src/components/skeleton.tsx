/** Animated placeholder block that inherits the `.skeleton` CSS shimmer effect. */
export function Skeleton({ w, h, r }: { w: string | number; h: number; r?: number }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r ?? "var(--radius-sharp)", flexShrink: 0 }}
    />
  );
}
