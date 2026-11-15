import { CheckmarkCircle01Icon, Copy01Icon, ViewIcon, ViewOffIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { SeedSurface, SetupFlow } from "@/components/setup-flow";
import { AcknowledgeCheckbox } from "./acknowledge-checkbox";

export function BackupStep({
  seed,
  revealed,
  copied,
  acknowledged,
  backupHandled,
  onCopy,
  onToggleReveal,
  onToggleAcknowledged,
  onContinue,
  onBack,
}: {
  seed: string;
  revealed: boolean;
  copied: boolean;
  acknowledged: boolean;
  backupHandled: boolean;
  onCopy: () => void;
  onToggleReveal: () => void;
  onToggleAcknowledged: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <SetupFlow
      current={2}
      total={4}
      title="Back up your seed"
      primaryLabel="Continue"
      primaryDisabled={!acknowledged || !backupHandled}
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
      <p style={{ margin: 0, fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
        Copy it to your chosen secure location or reveal it to record offline. You will confirm it on the next step.
      </p>
      <SeedSurface
        seed={seed}
        revealed={revealed}
      />
      <AcknowledgeCheckbox checked={acknowledged} onToggle={onToggleAcknowledged}>
        I stored this seed safely
      </AcknowledgeCheckbox>
    </SetupFlow>
  );
}
