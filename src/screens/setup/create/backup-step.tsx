import { CheckmarkCircle01Icon, Copy01Icon, ViewIcon, ViewOffIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { SeedSurface, SetupFlow } from "@/components/setup-flow";

export function BackupStep({
  seed,
  revealed,
  copied,
  backupHandled,
  onCopy,
  onToggleReveal,
  onContinue,
  onBack,
}: {
  seed: string;
  revealed: boolean;
  copied: boolean;
  backupHandled: boolean;
  onCopy: () => void;
  onToggleReveal: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <SetupFlow
      title="Back up your seed"
      description="Copy it to your chosen secure location or reveal it to record offline. You will confirm it on the next step."
      primaryLabel="Continue"
      primaryDisabled={!backupHandled}
      onPrimary={onContinue}
      onBack={onBack}
      secondaryActions={
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <Button variant="secondary" size="md" onClick={onCopy}>
            {copied ? <CheckmarkCircle01Icon size={18} strokeWidth={1.5} aria-hidden="true" /> : <Copy01Icon size={18} strokeWidth={1.5} aria-hidden="true" />}
            {copied ? "Copied" : "Copy seed"}
          </Button>
          <Button variant="secondary" size="md" onClick={onToggleReveal} aria-pressed={revealed}>
            {revealed ? <ViewOffIcon size={18} strokeWidth={1.5} aria-hidden="true" /> : <ViewIcon size={18} strokeWidth={1.5} aria-hidden="true" />}
            {revealed ? "Hide seed" : "Reveal seed"}
          </Button>
        </div>
      }
    >
      <SeedSurface seed={seed} revealed={revealed} />
    </SetupFlow>
  );
}
