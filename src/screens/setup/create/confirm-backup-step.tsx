import { SetupFlow } from "@/components/setup-flow";
import { SeedTextarea } from "../seed-textarea";

export function ConfirmBackupStep({
  confirmation,
  confirmationError,
  onConfirmationChange,
  onConfirm,
  onBack,
}: {
  confirmation: string;
  confirmationError: string;
  onConfirmationChange: (value: string) => void;
  onConfirm: () => void;
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
    >
      <SeedTextarea
        value={confirmation}
        onChange={onConfirmationChange}
        onSubmit={onConfirm}
        placeholder="Enter the complete seed"
        ariaLabel="Complete recovery seed"
        revealed
        obscure={false}
        error={confirmationError}
      />
    </SetupFlow>
  );
}
