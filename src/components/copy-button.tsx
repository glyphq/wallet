import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconButton } from "@/components/icon-button";
import { CheckIcon, Copy01Icon } from "@/lib/icons";
import { copyToClipboard } from "@/lib/clipboard";

/** Flat copy action that briefly shows a plain checkmark after copying. */
export function CopyButton({
  value,
  label,
  size = 16,
  style,
}: {
  value: string;
  label: string;
  size?: number;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  async function copy() {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <IconButton
      label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      disabled={!value}
      onClick={(event) => {
        event.stopPropagation();
        void copy();
      }}
      style={{ width: 30, height: 30, flexShrink: 0, ...style }}
    >
      {copied ? (
        <CheckIcon size={size} color="var(--color-text-primary)" aria-hidden="true" />
      ) : (
        <Copy01Icon size={size} aria-hidden="true" />
      )}
    </IconButton>
  );
}
