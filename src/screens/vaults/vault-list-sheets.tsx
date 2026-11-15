import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import type { VaultMeta } from "@/store/persisted";
import type { VaultImportData } from "./vault-import";

function SheetAction({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block", width: "100%", background: "none", border: "none",
        cursor: "pointer", textAlign: "left",
        padding: "12px var(--space-2)",
        fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
        color: danger ? "var(--color-status-error)" : "var(--color-text-primary)",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      {children}
    </button>
  );
}

interface VaultActionSheetProps {
  vault: VaultMeta | null;
  activeVaultId: string | null;
  onClose: () => void;
  onManageAccounts: (vault: VaultMeta) => void;
  onSwitch: (vault: VaultMeta) => void;
  onRename: (vault: VaultMeta) => void;
  onDelete: (vault: VaultMeta) => void;
}

export function VaultActionSheet({
  vault,
  activeVaultId,
  onClose,
  onManageAccounts,
  onSwitch,
  onRename,
  onDelete,
}: VaultActionSheetProps) {
  return (
    <Sheet open={!!vault} onClose={onClose} title={vault?.name ?? ""}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {vault && vault.id === activeVaultId && (
          <SheetAction onClick={() => onManageAccounts(vault)}>
            Manage accounts
          </SheetAction>
        )}
        {vault && vault.id !== activeVaultId && (
          <SheetAction onClick={() => onSwitch(vault)}>
            Switch to vault
          </SheetAction>
        )}
        <SheetAction onClick={() => vault && onRename(vault)}>
          Rename
        </SheetAction>
        <SheetAction danger onClick={() => vault && onDelete(vault)}>
          Delete vault
        </SheetAction>
      </div>
    </Sheet>
  );
}

interface SwitchVaultSheetProps {
  vault: VaultMeta | null;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  loading: boolean;
  onClose: () => void;
  onSwitch: () => void;
}

export function SwitchVaultSheet({ vault, password, onPasswordChange, error, loading, onClose, onSwitch }: SwitchVaultSheetProps) {
  return (
    <Sheet open={!!vault} onClose={() => { if (!loading) onClose(); }} title={`Unlock ${vault?.name ?? ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input
          type="password"
          label="Password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onSwitch()}
          error={error}
          placeholder="••••••••••"
          autoComplete="current-password"
          autoFocus
          disabled={loading}
        />
        <Button onClick={onSwitch} loading={loading} disabled={!password}>Unlock</Button>
      </div>
    </Sheet>
  );
}

interface RenameVaultSheetProps {
  vault: VaultMeta | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function RenameVaultSheet({ vault, value, onChange, onClose, onSave }: RenameVaultSheetProps) {
  return (
    <Sheet open={!!vault} onClose={onClose} title="Rename vault">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input
          label="Name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          placeholder="Vault name"
          autoFocus
        />
        <Button onClick={onSave} disabled={!value.trim()}>Save</Button>
      </div>
    </Sheet>
  );
}

interface DeleteVaultSheetProps {
  vault: VaultMeta | null;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteVaultSheet({ vault, password, onPasswordChange, error, loading, onClose, onDelete }: DeleteVaultSheetProps) {
  return (
    <Sheet open={!!vault} onClose={onClose} title={`Delete ${vault?.name ?? ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {(vault?.accounts.length ?? 0) > 1 && (
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
            color: "var(--color-status-warning)",
          }}>
            This vault contains {vault!.accounts.length} accounts. All seeds will be permanently lost.
          </span>
        )}
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
          color: "var(--color-text-secondary)",
        }}>
          This action cannot be undone.
        </span>
        <Input
          type="password"
          label="Password to confirm"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onDelete()}
          error={error}
          placeholder="••••••••••"
          autoComplete="current-password"
          autoFocus
        />
        <Button variant="danger" shape="sharp" onClick={onDelete} loading={loading}
          disabled={!password}>
          Delete vault
        </Button>
      </div>
    </Sheet>
  );
}

interface ImportVaultSheetProps {
  data: VaultImportData | null;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  loading: boolean;
  onClose: () => void;
  onImport: () => void;
}

export function ImportVaultSheet({ data, password, onPasswordChange, error, loading, onClose, onImport }: ImportVaultSheetProps) {
  return (
    <Sheet open={!!data} onClose={onClose} title={`Import ${data?.name ?? ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
            color: "var(--color-text-disabled)",
          }}>
            {data?.accounts.length ?? 0} {(data?.accounts.length ?? 0) === 1 ? "account" : "accounts"}
          </span>
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
            color: data?.signatureVerified ? "var(--color-status-success)" : "var(--color-status-warning)",
          }}>
            {data?.legacy ? "Legacy format v1" : data?.signatureVerified ? "Signed export verified" : "Signature not verified"}
          </span>
        </div>
        <Input
          type="password"
          label="Vault password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onImport()}
          error={error}
          placeholder="••••••••••"
          autoComplete="current-password"
          autoFocus
        />
        <Button onClick={onImport} loading={loading} disabled={!password}>Import vault</Button>
      </div>
    </Sheet>
  );
}

export function ImportVaultErrorSheet({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <Sheet open={!!error} onClose={onClose} title="Import failed">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
          color: "var(--color-text-secondary)",
        }}>
          {error}
        </span>
        <Button onClick={onClose}>OK</Button>
      </div>
    </Sheet>
  );
}
