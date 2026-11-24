import { useEffect, useRef, type CSSProperties } from "react";
import { statusOrb } from "asciify-engine/kit";

/** Engine-drawn loading spinner that inherits the splash palette. */
export function AsciiSpinner({ size = 104 }: { size?: number }) {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let orb: ReturnType<typeof statusOrb> | null = null;
    try {
      orb = statusOrb(host, { ring: true, colourByState: false });
      orb.loading();
    } catch {
      orb = null;
    }

    return () => orb?.destroy();
  }, []);

  return (
    <span
      ref={hostRef}
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        color: "var(--color-text-tertiary)",
        "--ascii-ink-strong": "var(--color-text-tertiary)",
      } as CSSProperties}
    />
  );
}
