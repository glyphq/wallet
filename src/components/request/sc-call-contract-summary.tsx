/** Primary summary for a contract call: contract name, procedure, and attached amount. */
export function ScCallContractSummary({
  contractName,
  inputTypeLabel,
  amountQu,
}: {
  contractName: string;
  inputTypeLabel: string;
  /** Formatted QU amount, or null when no amount is attached. */
  amountQu: string | null;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 300, fontSize: "var(--text-display)", color: "var(--color-text-display)", letterSpacing: "-0.02em", lineHeight: 1 }}>
        {contractName}
      </div>
      <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
        {inputTypeLabel}
      </div>
      {amountQu !== null && (
        <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)", color: "var(--color-text-secondary)" }}>
          {amountQu} QU
        </div>
      )}
    </div>
  );
}
