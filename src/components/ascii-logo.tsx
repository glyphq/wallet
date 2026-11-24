import { useEffect, useRef } from "react";
import { ditherImage } from "asciify-engine/kit";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";

/** Animated ASCII rendering of the Glyph mark for the splash screen. */
export function AsciiLogo() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let handle: ReturnType<typeof ditherImage> | null = null;
    try {
      handle = ditherImage(host, {
        mark: "glyph",
        cellSize: 5,
        tones: ["transparent", "#a0a4a5"],
        reveal: "visible",
        duration: 1_100,
        label: "Glyph",
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
      style={{ width: 156, height: 156, position: "relative", overflow: "hidden" }}
    >
      <img
        src={glyphOnDark}
        alt=""
        aria-hidden="true"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}
