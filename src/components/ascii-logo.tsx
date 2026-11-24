import { useEffect, useRef } from "react";
import { background, wordField } from "asciify-engine/kit";

/** Animated ASCII wordmark used on the splash screen. */
export function AsciiLogo() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let handle: ReturnType<typeof background> | null = null;
    try {
      handle = background(host, {
        preset: wordField,
        text: "GLYPH",
        palette: "#a0a4a5",
        speed: 0.9,
        opacity: 0.95,
        cursor: "trail",
        dither: 0,
        look: { scene: "orb" },
        lazy: false,
      });
    } catch {
      handle = null;
    }

    return () => handle?.destroy();
  }, []);

  return (
    <div
      ref={hostRef}
      aria-label="Glyph"
      role="img"
      style={{ width: "min(340px, 82vw)", height: 150, position: "relative", overflow: "hidden" }}
    />
  );
}
