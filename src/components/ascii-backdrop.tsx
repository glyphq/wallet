import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { background, drift } from "asciify-engine/kit";

interface ClearRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Landing-style drifting ASCII field behind copy. The field lives in a sibling
 * layer so content height drives the container, and fades out behind headline
 * and paragraph line boxes. Unsupported WebGL2 leaves the content untouched.
 */
export function AsciiBackdrop({ children, style, contentStyle }: { children?: ReactNode; style?: CSSProperties; contentStyle?: CSSProperties }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const copy = copyRef.current;
    if (!host || !copy) return;

    let clearRects: ClearRect[] = [];
    let clearKey = "";

    const measureClear = () => {
      const hostRect = host.getBoundingClientRect();
      const copyRect = copy.getBoundingClientRect();
      const key = [
        window.scrollY,
        window.innerWidth,
        hostRect.width,
        hostRect.height,
        copyRect.width,
        copyRect.height,
        copy.textContent,
        document.fonts.status,
      ].join(":");
      if (key === clearKey) return clearRects;

      const rects: ClearRect[] = [];
      for (const element of copy.querySelectorAll("h1, h2, p, .asciify-clear")) {
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
    <div style={{ position: "relative", ...style }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
      {children ? (
        <div
          ref={copyRef}
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "var(--space-10)",
            ...contentStyle,
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
