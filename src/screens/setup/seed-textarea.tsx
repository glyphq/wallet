import { KeyRoundIcon, ViewIcon, ViewOffIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { Textarea } from "@/components/textarea";
import { asciiSeedMask } from "@/components/setup-flow";

/** Masked recovery-seed entry shared by the create and restore flows. */
export function SeedTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  autoCapitalize,
  revealed,
  obscure = true,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  ariaLabel: string;
  autoCapitalize?: string;
  revealed: boolean;
  obscure?: boolean;
  error?: string;
}) {
  const masked = obscure && !revealed && value.length > 0;

  return (
    <Textarea
      leftElement={<KeyRoundIcon size={18} strokeWidth={1.5} />}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") onSubmit();
      }}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoCapitalize={autoCapitalize}
      autoFocus
      technical
      error={error}
      overlay={masked ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            padding: "var(--space-3) var(--space-4) var(--space-3) 48px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.875rem",
            lineHeight: "var(--leading-compact)",
            letterSpacing: "0.015em",
            color: "var(--color-text-primary)",
            overflowWrap: "anywhere",
            userSelect: "none",
          }}
        >
          {asciiSeedMask(value)}
        </div>
      ) : undefined}
      style={{
        resize: "none",
        minHeight: 136,
        overflowWrap: "anywhere",
        color: masked ? "transparent" : undefined,
        caretColor: masked ? "var(--color-text-primary)" : undefined,
      }}
    />
  );
}

/** Full-width toggle that unmasks a seed entry field. */
export function SeedRevealButton({ revealed, onToggle }: { revealed: boolean; onToggle: () => void }) {
  return (
    <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={onToggle} aria-pressed={revealed}>
      {revealed ? <ViewOffIcon size={18} strokeWidth={1.5} aria-hidden="true" /> : <ViewIcon size={18} strokeWidth={1.5} aria-hidden="true" />}
      {revealed ? "Hide entered seed" : "Reveal entered seed"}
    </Button>
  );
}
