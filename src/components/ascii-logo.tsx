import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { background, drift } from "asciify-engine/kit";
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
        preset: drift,
        palette: "#8f8d86",
        cellSize: 11,
        speed: 0.8,
        opacity: 0.35,
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
    <div style={{ position: "relative", width: 240, height: 180, overflow: "hidden", display: "grid", placeItems: "center" }}>
      <div ref={hostRef} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />
      <motion.img
        src={glyphOnDark}
        alt=""
        aria-hidden="true"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 28, repeat: Infinity, ease: "linear" }}
        style={{ position: "relative", zIndex: 1, width: 108, height: 108, objectFit: "contain" }}
      />
    </div>
  );
}
