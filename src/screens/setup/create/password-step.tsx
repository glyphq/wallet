import { PasswordFields, SetupFlow } from "@/components/setup-flow";

export function PasswordStep({
  password,
  confirmPassword,
  visible,
  passwordValid,
  loading,
  error,
  onPasswordChange,
  onConfirmChange,
  onToggleVisibility,
  onSubmit,
  onBack,
}: {
  password: string;
  confirmPassword: string;
  visible: boolean;
  passwordValid: boolean;
  loading: boolean;
  error: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onToggleVisibility: () => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <SetupFlow
      title="Set a password"
      primaryLabel="Create wallet"
      primaryDisabled={!passwordValid}
      primaryLoading={loading}
      onPrimary={onSubmit}
      onBack={onBack}
      error={error}
    >
      <PasswordFields
        password={password}
        confirmPassword={confirmPassword}
        visible={visible}
        onPasswordChange={onPasswordChange}
        onConfirmChange={onConfirmChange}
        onToggleVisibility={onToggleVisibility}
        onSubmit={onSubmit}
      />
    </SetupFlow>
  );
}
