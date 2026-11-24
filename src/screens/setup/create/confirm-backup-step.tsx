import { SetupFlow } from "@/components/setup-flow";
import { SeedRevealButton, SeedTextarea } from "../seed-textarea";

export function ConfirmBackupStep({
  confirmation,
  confirmationError,
  revealed,
  onConfirmationChange,
  onToggleReveal,
  onConfirm,
  onBack,
}: {
  confirmation: string;
  confirmationError: string;
  revealed: boolean;
  onConfirmationChange: (value: string) => void;
  onToggleReveal: () => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <SetupFlow
      title="Confirm your backup"
      primaryLabel="Continue"
      primaryDisabled={!confirmation.trim()}
      onPrimary={onConfirm}
      onBack={onBack}
      secondaryActions={
        <SeedRevealButton revealed={revealed} onToggle={onToggleReveal} />
      }
    >
      <p style={{ margin: 0, fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
        Type the complete seed exactly as you saved it.
      </p>
      <SeedTextarea
        value={confirmation}
        onChange={onConfirmationChange}
        onSubmit={onConfirm}
        placeholder="Enter the complete seed"
        ariaLabel="Complete recovery seed"
        revealed={revealed}
        error={confirmationError}
      />
    </SetupFlow>
  );
}
