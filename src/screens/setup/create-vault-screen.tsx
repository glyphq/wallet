import { FullPage } from "@/layouts/full-page";
import { BackupStep } from "./create/backup-step";
import { ConfirmBackupStep } from "./create/confirm-backup-step";
import { NameStep } from "./create/name-step";
import { PasswordStep } from "./create/password-step";
import { useCreateVaultFlow } from "./create/use-create-vault-flow";

export default function CreateVaultScreen() {
  const flow = useCreateVaultFlow();

  return (
    <FullPage centered={false} style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      {flow.step === 1 ? (
        <NameStep
          name={flow.name}
          error={flow.nameError}
          onNameChange={(name) => {
            flow.setName(name);
            flow.setNameError("");
          }}
          onContinue={flow.continueFromName}
          onBack={flow.back}
        />
      ) : null}

      {flow.step === 2 ? (
        <BackupStep
          seed={flow.seed}
          revealed={flow.backupSeedRevealed}
          copied={flow.copied}
          acknowledged={flow.acknowledged}
          backupHandled={flow.backupSeedHandled}
          onCopy={flow.copySeed}
          onToggleReveal={flow.toggleBackupSeed}
          onToggleAcknowledged={flow.toggleAcknowledged}
          onContinue={flow.continueFromBackup}
          onBack={flow.back}
        />
      ) : null}

      {flow.step === 3 ? (
        <ConfirmBackupStep
          confirmation={flow.confirmation}
          confirmationError={flow.confirmationError}
          revealed={flow.confirmationRevealed}
          onConfirmationChange={(value) => {
            flow.setConfirmation(value);
            flow.setConfirmationError("");
          }}
          onToggleReveal={flow.toggleConfirmationRevealed}
          onConfirm={flow.confirmBackup}
          onBack={flow.back}
        />
      ) : null}

      {flow.step === 4 ? (
        <PasswordStep
          password={flow.password}
          confirmPassword={flow.confirmPassword}
          visible={flow.passwordsVisible}
          passwordValid={flow.passwordValid}
          loading={flow.loading}
          error={flow.setupError}
          onPasswordChange={flow.setPassword}
          onConfirmChange={flow.setConfirmPassword}
          onToggleVisibility={flow.togglePasswordsVisible}
          onSubmit={flow.finish}
          onBack={flow.back}
        />
      ) : null}
    </FullPage>
  );
}
