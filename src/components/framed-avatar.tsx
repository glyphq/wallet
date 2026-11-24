import { MarbleAvatar } from "@/components/marble-avatar";

/** Deterministic generated avatar without a surrounding frame. */
export function FramedAvatar({ seed, size = 30 }: { seed: string; size?: number }) {
  return <MarbleAvatar seed={seed} size={size} />;
}
