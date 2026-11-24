import { KeyRoundIcon } from "@/lib/icons";
import { Textarea } from "@/components/textarea";

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
      style={{
        resize: "none",
        minHeight: 136,
        overflowWrap: "anywhere",
        filter: !obscure || revealed ? "none" : "blur(6px)",
        transition: "filter var(--duration-fast) var(--ease-out)",
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
