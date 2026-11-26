import { LockKeyholeIcon } from "@/lib/icons";
import { Input } from "@/components/input";
import { MAX_WALLET_ACCOUNTS } from "@/hooks/use-wallet-balances";
import { SetupFlow } from "@/components/setup-flow";
import { ImportAccountList } from "./import-account-list";
import type { WalletFileImport } from "./use-wallet-file-import";

/** Inline unlock step shown after a wallet backup is picked or dropped. */
export function ImportWalletStep({ flow }: { flow: WalletFileImport }) {
  const data = flow.importData;
  if (!data) return null;

  const accountLabel = `${data.accounts.length} ${data.accounts.length === 1 ? "account" : "accounts"}`;
  const warning = data.legacy
    ? "Legacy format v1 detected. Import only if you trust the export source."
    : data.signatureVerified
      ? ""
      : "Signature could not be verified on this device.";

  return (
    <SetupFlow
      title="Import wallet"
      description={`${data.name} · ${accountLabel}`}
      primaryLabel="Import wallet"
      primaryDisabled={flow.importDisabled}
      primaryLoading={flow.importLoading}
      onPrimary={flow.doImport}
      onBack={flow.cancelImport}
      error={flow.importError}
    >
      {flow.importNeedsSelection ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body-compact)",
              lineHeight: "var(--leading-body)",
              color: "var(--color-text-secondary)",
            }}
          >
            This export has more accounts than one wallet can hold. Choose up to {MAX_WALLET_ACCOUNTS}.
          </div>
          <ImportAccountList
            accounts={data.accounts}
            selectedIndices={flow.selectedIndices}
            onToggle={flow.toggleAccount}
          />
        </div>
      ) : null}

      {warning ? (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body-compact)",
            lineHeight: "var(--leading-body)",
            color: "var(--color-status-warning)",
          }}
        >
          {warning}
        </p>
      ) : null}

      <Input
        label="Wallet password"
        leftElement={<LockKeyholeIcon size={18} strokeWidth={1.5} />}
        type="password"
        value={flow.importPw}
        onChange={(event) => {
          flow.setImportPw(event.target.value);
          flow.setImportError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !flow.importDisabled) void flow.doImport();
        }}
        placeholder="Enter the export password"
        autoComplete="current-password"
      />
    </SetupFlow>
  );
}
