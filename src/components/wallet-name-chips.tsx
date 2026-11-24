import { ChoiceChips } from "@/components/choice-chips";

const WALLET_NAME_SUGGESTIONS = ["Main", "Daily", "Savings", "Trading", "Treasury", "Cold"] as const;

/** Quick wallet-name presets; selecting one replaces the current name. */
export function WalletNameChips({ value, onSelect }: { value: string; onSelect: (name: string) => void }) {
  return (
    <ChoiceChips
      label="Wallet name suggestions"
      options={WALLET_NAME_SUGGESTIONS.map((name) => ({ value: name, label: name }))}
      selected={value}
      onSelect={onSelect}
    />
  );
}
