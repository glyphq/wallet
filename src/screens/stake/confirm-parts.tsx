import { Button } from "@/components/button";
import { TextButton } from "@/components/text-button";

/** Large centered amount shown at the top of a confirm step. */
export function ConfirmAmountHeader({ amount }: { amount: string }) {
  return (
    <div style={{ textAlign: "center", paddingTop: "var(--space-4)", paddingBottom: "var(--space-2)" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
        {amount}
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: "var(--space-1)" }}>QU</div>
    </div>
  );
}

interface ConfirmActionsProps {
  disabled: boolean;
  onSend: () => void;
  onCancel: () => void;
}

/** Sign-and-send plus cancel actions shared by the confirm steps. */
export function ConfirmActions({ disabled, onSend, onCancel }: ConfirmActionsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingBottom: "var(--space-6)" }}>
      <Button
        onClick={onSend}
        disabled={disabled}
      >
        Sign and send
      </Button>
      <TextButton type="button" tone="muted" onClick={onCancel} style={{ alignSelf: "center", padding: "var(--space-2) 0" }}>
        Cancel
      </TextButton>
    </div>
  );
}
