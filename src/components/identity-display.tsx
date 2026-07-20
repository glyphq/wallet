import { useState, useEffect, useRef, type CSSProperties } from "react";
import { motion } from "motion/react";
import { transition } from "@/lib/animations";
import { usePersistedStore } from "@/store/persisted";
import { truncateId } from "@/lib/format";
import { clearClipboard, copyToClipboard } from "@/lib/clipboard";
import { Identicon } from "@/components/identicon";

export interface IdentityDisplayProps {
  identity: string;
  style?: CSSProperties;
  showIdenticon?: boolean;
}

export function IdentityDisplay({ identity, style, showIdenticon = true }: IdentityDisplayProps) {
  const clearSecs = usePersistedStore((s) => s.settings.clipboardClearSeconds);
  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  async function copy() {
    await copyToClipboard(identity, clearSecs);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    if (clearSecs > 0) {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      setCountdown(clearSecs);
      intervalRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c === null || c <= 1) {
            if (intervalRef.current !== null) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return null;
          }
          return c - 1;
        });
      }, 1000);
    }
  }

  async function clearNow() {
    await clearClipboard();
    setCountdown(null);
  }

  function toggle() {
    if (!expanded) copy();
    setExpanded((v) => !v);
  }

  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {showIdenticon && !expanded && <Identicon kind="identity" seed={identity} size={18} radius={3} style={{ flexShrink: 0 }} />}
        <motion.button
          animate={{ opacity: flash ? 0.6 : 1 }}
          className={flash ? "flash-success" : ""}
          transition={transition.quick}
          onClick={toggle}
          aria-label={expanded ? `Address: ${identity} — click to collapse` : `Copy address ${truncateId(identity, 10, 10)}`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-lg)",
            color: "var(--color-text-primary)",
            letterSpacing: "0.05em",
            padding: 0,
            textAlign: "left",
            wordBreak: "break-all",
          }}
        >
          {expanded ? identity : truncateId(identity, 10, 10)}
        </motion.button>
      </div>
      {countdown !== null && (
        <div
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            marginTop: "var(--space-1)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-disabled)",
              letterSpacing: "0.05em",
            }}
          >
            Clipboard clears in {countdown}s
          </span>
          <button
            onClick={clearNow}
            aria-label="Clear clipboard now"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-mono-sm)",
              color: "var(--color-text-secondary)",
              letterSpacing: "0.05em",
              padding: 0,
            }}
          >
            Clear now
          </button>
        </div>
      )}
    </div>
  );
}
