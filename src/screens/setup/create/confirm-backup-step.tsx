import { SetupFlow } from "@/components/setup-flow";
import { SeedRevealButton, SeedTextarea } from "../seed-textarea";

export function ConfirmBackupStep({
  confirmation,
  confirmationError,
  revealed,
  onConfirmationChange,
  onConfirm,
  onToggleReveal,
  onBack,
}: {
  confirmation: string;
  confirmationError: string;
  revealed: boolean;
  onConfirmationChange: (value: string) => void;
  onConfirm: () => void;
  onToggleReveal: () => void;
  onBack: () => void;
}) {
  return (
    <SetupFlow
      title="Confirm your backup"
      description="Type the complete seed exactly as you saved it."
      primaryLabel="Continue"
      primaryDisabled={!confirmation.trim()}
      onPrimary={onConfirm}
      onBack={onBack}
      secondaryActions={<SeedRevealButton revealed={revealed} onToggle={onToggleReveal} />}
    >
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
