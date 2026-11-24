const WALLET_NAME_SUGGESTIONS = ["Main", "Daily", "Savings", "Trading", "Treasury", "Cold"] as const;

/** Quick wallet-name presets; selecting one replaces the current name. */
export function WalletNameChips({ value, onSelect }: { value: string; onSelect: (name: string) => void }) {
  return (
    <div className="wallet-name-chips">
      {WALLET_NAME_SUGGESTIONS.map((name) => {
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            className="wallet-name-chip corner-frame"
            data-selected={selected ? "true" : "false"}
            aria-pressed={selected}
            onClick={() => onSelect(name)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
