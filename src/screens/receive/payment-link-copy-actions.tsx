import { CheckmarkCircle01Icon, Copy01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { sectionStyle } from "./payment-link-utils";

function CopyButton({ label, copied, onCopy }: { label: string; copied: boolean; onCopy: () => void }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      shape="sharp"
      onClick={onCopy}
      style={{ width: "100%", color: copied ? "var(--color-accent)" : undefined }}
      aria-live="polite"
    >
      {copied ? (
        <>
          <CheckmarkCircle01Icon size={14} />
          Copied
        </>
      ) : (
        <>
          <Copy01Icon size={14} />
          {label}
        </>
      )}
    </Button>
  );
}

export function PaymentLinkCopyActions({
  copiedWeb,
  copiedDeep,
  onCopyWeb,
  onCopyDeep,
}: {
  copiedWeb: boolean;
  copiedDeep: boolean;
  onCopyWeb: () => void;
  onCopyDeep: () => void;
}) {
  return (
    <section aria-labelledby="copy-actions-heading" style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
      <span id="copy-actions-heading" className="sr-only">Copy actions</span>
      <CopyButton
        label="Copy web link"
        copied={copiedWeb}
        onCopy={onCopyWeb}
      />
      <CopyButton
        label="Copy app link"
        copied={copiedDeep}
        onCopy={onCopyDeep}
      />
    </section>
  );
}
