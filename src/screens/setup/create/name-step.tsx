import { Wallet01Icon } from "@/lib/icons";
import { Input } from "@/components/input";
import { SetupFlow } from "@/components/setup-flow";

export function NameStep({
  name,
  error,
  onNameChange,
  onContinue,
  onBack,
}: {
  name: string;
  error: string;
  onNameChange: (name: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <SetupFlow current={1} total={4} title="Name your Vault" primaryLabel="Continue" onPrimary={onContinue} onBack={onBack}>
      <Input
        leftElement={<Wallet01Icon size={18} strokeWidth={1.5} />}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && onContinue()}
        placeholder="Vault name"
        aria-label="Vault name"
        autoFocus
        error={error}
      />
    </SetupFlow>
  );
}
