import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { background, drift } from "asciify-engine/kit";

interface ClearRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Landing-style drifting ASCII field behind onboarding copy. The field fades
 * out behind headline and paragraph line boxes; reduced-motion and WebGL2
 * failures leave the content untouched.
 */
export function AsciiBackdrop({ children, style, contentStyle }: { children: ReactNode; style?: CSSProperties; contentStyle?: CSSProperties }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const copy = copyRef.current;
    if (!host) return;

    let clearRects: ClearRect[] = [];
    let clearKey = "";

    const measureClear = () => {
      if (!copy) return clearRects;
      const hostRect = host.getBoundingClientRect();
      const copyRect = copy.getBoundingClientRect();
      const key = [
        window.scrollY,
        window.innerWidth,
        hostRect.width,
        hostRect.height,
        copyRect.width,
        copyRect.height,
        document.fonts.status,
      ].join(":");
      if (key === clearKey) return clearRects;

      const rects: ClearRect[] = [];
      for (const element of copy.querySelectorAll("h2, p, .asciify-clear")) {
        const range = document.createRange();
        range.selectNodeContents(element);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) {
            rects.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
          }
        }
      }
      clearRects = rects;
      clearKey = key;
      return clearRects;
    };

    let handle: ReturnType<typeof background> | null = null;
    try {
      handle = background(host, {
        preset: drift,
        palette: "#8f8d86",
        cellSize: 11,
        speed: 1,
        opacity: 0.55,
        mark: "glyph",
        cursor: "trail",
        dither: 0,
        look: { scene: "flow" },
        lazy: false,
        clear: measureClear,
        clearPadding: 10,
        clearSoftness: 26,
        clearStrength: 0.9,
      });
    } catch {
      handle = null;
    }

    return () => handle?.destroy();
  }, []);

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
      <div
        ref={copyRef}
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "var(--space-10)",
          padding: "clamp(32px, 5vw, 72px)",
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
