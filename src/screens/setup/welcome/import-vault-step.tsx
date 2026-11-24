import { LockKeyholeIcon } from "@/lib/icons";
import { Input } from "@/components/input";
import { MAX_VAULT_ACCOUNTS } from "@/hooks/use-vault-balances";
import { SetupFlow } from "@/components/setup-flow";
import { ImportAccountList } from "./import-account-list";
import type { VaultFileImport } from "./use-vault-file-import";

/** Inline unlock step shown after a Vault export is picked or dropped. */
export function ImportVaultStep({ flow }: { flow: VaultFileImport }) {
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
      title="Import Vault"
      description={`${data.name} · ${accountLabel}`}
      primaryLabel="Import Vault"
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
            This export has more accounts than one Vault can hold. Choose up to {MAX_VAULT_ACCOUNTS}.
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
        label="Vault password"
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
