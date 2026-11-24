import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { background, fluid } from "asciify-engine/kit";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";

/** Animated ASCII field with the Glyph mark rotating above it on the splash. */
export function AsciiLogo() {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let handle: ReturnType<typeof background> | null = null;
    try {
      handle = background(host, {
        preset: fluid,
        palette: "#8f8d86",
        cellSize: 10,
        speed: 1.5,
        opacity: 0.45,
        mark: "glyph",
        cursor: "trail",
        dither: 0,
        look: { scene: "flow" },
        lazy: false,
      });
    } catch {
      handle = null;
    }

    return () => handle?.destroy();
  }, []);

  return (
    <div style={{ position: "relative", width: 260, height: 200, overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div
        ref={hostRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          WebkitMaskImage: "radial-gradient(ellipse at center, #000 32%, transparent 72%)",
          maskImage: "radial-gradient(ellipse at center, #000 32%, transparent 72%)",
        }}
      />
      <motion.img
        src={glyphOnDark}
        alt=""
        aria-hidden="true"
        animate={reduceMotion ? undefined : { rotate: 360, scale: [1, 1.04, 1] }}
        transition={{
          rotate: { duration: 16, repeat: Infinity, ease: "linear" },
          scale: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{ position: "relative", zIndex: 1, width: 116, height: 116, objectFit: "contain" }}
      />
    </div>
  );
}
