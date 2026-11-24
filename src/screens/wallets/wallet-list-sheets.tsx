import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import type { WalletMeta } from "@/store/persisted";
import type { WalletImportData } from "./wallet-import";

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

interface WalletActionSheetProps {
  wallet: WalletMeta | null;
  activeWalletId: string | null;
  onClose: () => void;
  onManageAccounts: (wallet: WalletMeta) => void;
  onRename: (wallet: WalletMeta) => void;
  onDelete: (wallet: WalletMeta) => void;
}

export function WalletActionSheet({
  wallet,
  activeWalletId,
  onClose,
  onManageAccounts,
  onRename,
  onDelete,
}: WalletActionSheetProps) {
  return (
    <Sheet open={!!wallet} onClose={onClose} title={wallet?.name ?? ""}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {wallet && wallet.id === activeWalletId && (
          <SheetAction onClick={() => onManageAccounts(wallet)}>
            Manage accounts
          </SheetAction>
        )}
        <SheetAction onClick={() => wallet && onRename(wallet)}>
          Rename
        </SheetAction>
        <SheetAction danger onClick={() => wallet && onDelete(wallet)}>
          Delete wallet
        </SheetAction>
      </div>
    </Sheet>
  );
}

interface RenameWalletSheetProps {
  wallet: WalletMeta | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function RenameWalletSheet({ wallet, value, onChange, onClose, onSave }: RenameWalletSheetProps) {
  return (
    <Sheet open={!!wallet} onClose={onClose} title="Rename wallet">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input
          label="Name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          placeholder="Wallet name"
          autoFocus
        />
        <Button onClick={onSave} disabled={!value.trim()}>Save</Button>
      </div>
    </Sheet>
  );
}

interface DeleteWalletSheetProps {
  wallet: WalletMeta | null;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  loading: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function DeleteWalletSheet({ wallet, password, onPasswordChange, error, loading, onClose, onDelete }: DeleteWalletSheetProps) {
  return (
    <Sheet open={!!wallet} onClose={onClose} title={`Delete ${wallet?.name ?? ""}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {(wallet?.accounts.length ?? 0) > 1 && (
          <span style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
            color: "var(--color-status-warning)",
          }}>
            This wallet contains {wallet!.accounts.length} accounts. All seeds will be permanently lost.
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
          Delete wallet
        </Button>
      </div>
    </Sheet>
  );
}

interface ImportWalletSheetProps {
  data: WalletImportData | null;
  password: string;
  onPasswordChange: (value: string) => void;
  error: string;
  loading: boolean;
  onClose: () => void;
  onImport: () => void;
}

export function ImportWalletSheet({ data, password, onPasswordChange, error, loading, onClose, onImport }: ImportWalletSheetProps) {
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
          label="Wallet password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onImport()}
          error={error}
          placeholder="••••••••••"
          autoComplete="current-password"
          autoFocus
        />
        <Button onClick={onImport} loading={loading} disabled={!password}>Import wallet</Button>
      </div>
    </Sheet>
  );
}

export function ImportWalletErrorSheet({ error, onClose }: { error: string; onClose: () => void }) {
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
