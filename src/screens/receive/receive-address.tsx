import { useState } from "react";
import { CheckmarkCircle01Icon, Copy01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { copyToClipboard } from "@/lib/clipboard";

/** Full receive address with an explicit copy action and no clipboard timer. */
export function ReceiveAddress({ identity }: { identity: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    const copied = await copyToClipboard(identity, 0);
    setStatus(copied ? "copied" : "error");
    window.setTimeout(() => setStatus("idle"), 1_800);
  }

  const copied = status === "copied";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", width: "100%" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-mono-sm)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-tertiary)",
        }}
      >
        Your address
      </span>

      <div
        className="receive-address-box corner-frame"
        style={{
          width: "100%",
          maxWidth: 340,
          textAlign: "center",
          wordBreak: "break-all",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body-compact)",
          lineHeight: "var(--leading-body)",
          letterSpacing: "0.04em",
          color: "var(--color-text-primary)",
        }}
      >
        {identity}
      </div>

      <Button
        variant="secondary"
        size="md"
        onClick={copy}
        style={{ width: 180 }}
        aria-live="polite"
      >
        {copied ? <CheckmarkCircle01Icon size={18} aria-hidden="true" /> : <Copy01Icon size={18} aria-hidden="true" />}
        {copied ? "Copied" : status === "error" ? "Copy failed" : "Copy address"}
      </Button>
    </div>
  );
}
