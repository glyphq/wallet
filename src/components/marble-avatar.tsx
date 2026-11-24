import { useEffect, useRef, useState } from "react";
import Avatar from "boring-avatars";
import { gridToSvg, imageToAsciiGrid } from "asciify-engine/headless";

const MARBLE_COLORS = ["#ccfcfb", "#7dd3fc", "#6ee7b7", "#fbbf24", "#a78bfa", "#f87171"];
const ASCII_AVATAR_CACHE = new Map<string, string>();
const ASCII_CELL_ASPECT = 1.67;

export interface MarbleAvatarProps {
  seed: string;
  size: number;
  square?: boolean;
  ascii?: boolean;
}

/** Deterministic marble avatar, rendered through the ASCII engine at full size. */
export function MarbleAvatar({ seed, size, square = true, ascii = true }: MarbleAvatarProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [asciiSrc, setAsciiSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!ascii) {
      setAsciiSrc(null);
      return;
    }

    const cacheKey = `${seed}:${size}:${square}`;
    const cached = ASCII_AVATAR_CACHE.get(cacheKey);
    if (cached) {
      setAsciiSrc(cached);
      return;
    }

    const source = hostRef.current?.querySelector("svg");
    if (!source) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    const markup = new XMLSerializer().serializeToString(source);
    objectUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;
      try {
        const columns = Math.max(10, Math.round(size / 6));
        const rows = Math.max(6, Math.round(columns / ASCII_CELL_ASPECT));
        const grid = imageToAsciiGrid(image, {
          columns,
          rows,
          mode: "tone",
          charset: " .:-=+*#",
          cellAspect: ASCII_CELL_ASPECT,
          background: "dark",
          color: true,
          dither: "ordered",
          contrast: 0.9,
          brightness: 0.08,
        });
        const output = gridToSvg(grid, {
          color: true,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 10,
          lineHeight: 1,
        });
        const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(output)}`;
        ASCII_AVATAR_CACHE.set(cacheKey, src);
        setAsciiSrc(src);
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ascii, seed, size, square]);

  return (
    <span aria-hidden="true" style={{ position: "relative", display: "block", width: size, height: size, background: "var(--color-bg-surface-2)" }}>
      {ascii ? (
        <span
          ref={hostRef}
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}
        >
          <Avatar size={size} name={seed} variant="marble" colors={MARBLE_COLORS} square={square} />
        </span>
      ) : null}
      {asciiSrc ? (
        <img
          alt=""
          src={asciiSrc}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <Avatar size={size} name={seed} variant="marble" colors={MARBLE_COLORS} square={square} />
      )}
    </span>
  );
}
