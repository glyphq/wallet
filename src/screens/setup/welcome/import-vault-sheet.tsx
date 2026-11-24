import { LockKeyholeIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { WalletAppearancePicker } from "@/components/wallet-appearance-picker";
import { MAX_VAULT_ACCOUNTS } from "@/hooks/use-vault-balances";
import { ImportAccountList } from "./import-account-list";
import type { VaultFileImport } from "./use-vault-file-import";

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "var(--radius-sheet)",
  padding: "var(--space-5)",
};

/** Sheet that previews a picked Vault export and unlocks it with the export password. */
export function ImportVaultSheet({ flow }: { flow: VaultFileImport }) {
  const {
    importData,
    setImportData,
    importPw,
    setImportPw,
    importError,
    setImportError,
    importLoading,
    selectedIndices,
    importWalletIcon,
    setImportWalletIcon,
    importWalletColor,
    setImportWalletColor,
    importNeedsSelection,
    importDisabled,
    toggleAccount,
    doImport,
  } = flow;

  return (
    <Sheet open={!!importData} onClose={() => setImportData(null)} title={`Import ${importData?.name ?? "Vault"}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <FlowHeader
          title="Unlock Vault file"
          description={importData && importData.accounts.length > MAX_VAULT_ACCOUNTS
            ? `${selectedIndices.size} of ${MAX_VAULT_ACCOUNTS} accounts selected`
            : `${importData?.accounts.length ?? 0} ${(importData?.accounts.length ?? 0) === 1 ? "account" : "accounts"} · ${importData?.name ?? "Vault"}`}
        />

        <WalletAppearancePicker
          icon={importWalletIcon}
          color={importWalletColor}
          onIconChange={setImportWalletIcon}
          onColorChange={setImportWalletColor}
        />

        <div
          style={{
            ...cardStyle,
            padding: "var(--space-4)",
            borderColor: importData?.signatureVerified ? "color-mix(in srgb, var(--color-status-success) 35%, var(--color-border-default))" : "color-mix(in srgb, var(--color-status-warning) 35%, var(--color-border-default))",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body-compact)",
              lineHeight: "var(--leading-body)",
              color: importData?.signatureVerified ? "var(--color-status-success)" : "var(--color-status-warning)",
            }}
          >
            {importData?.legacy
              ? "Legacy format v1 detected. Import only if you trust the export source."
              : importData?.signatureVerified
                ? `Signed export v${importData?.formatVersion ?? 2} verified on this device.`
                : `Signed export v${importData?.formatVersion ?? 2} could not be verified on this device.`}
          </div>
        </div>

        {importData && importNeedsSelection ? (
          <ImportAccountList
            accounts={importData.accounts}
            selectedIndices={selectedIndices}
            onToggle={toggleAccount}
          />
        ) : null}

        <Input
          label="Vault password"
          leftElement={<LockKeyholeIcon size={18} strokeWidth={1.5} />}
          type="password"
          value={importPw}
          onChange={(event) => {
            setImportPw(event.target.value);
            setImportError("");
          }}
          onKeyDown={(event) => event.key === "Enter" && !importLoading && doImport()}
          placeholder="Enter the export password"
          autoComplete="current-password"
          autoFocus
          error={importError}
        />

        <Button onClick={doImport} disabled={importDisabled} loading={importLoading}>
          Import Vault
        </Button>
      </div>
    </Sheet>
  );
}
