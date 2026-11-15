import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";

interface ExportVaultSheetProps {
  open: boolean;
  onClose: () => void;
  vaultName: string;
  onExport: () => void;
}

export function ExportVaultSheet({ open, onClose, vaultName, onExport }: ExportVaultSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={`Export ${vaultName}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)" }}>
          This file contains your encrypted seed. Keep it safe. Anyone with this file and your password can access your funds.
        </span>
        <Button onClick={onExport}>Download01Icon backup file</Button>
      </div>
    </Sheet>
  );
}

interface RotatePasswordSheetProps {
  open: boolean;
  onClose: () => void;
  done: boolean;
  oldPassword: string;
  setOldPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  error: string;
  setError: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
}

export function RotatePasswordSheet({
  open,
  onClose,
  done,
  oldPassword,
  setOldPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  error,
  setError,
  loading,
  onSubmit,
}: RotatePasswordSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Change vault password">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {done ? (
          <>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-mono-sm)", color: "var(--color-status-success)", letterSpacing: "0.05em" }}>
              Password changed
            </div>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Input type="password" label="Current password" value={oldPassword} onChange={(e) => { setOldPassword(e.target.value); setError(""); }} error="" placeholder="••••••••••" autoComplete="current-password" autoFocus />
            <Input type="password" label="New password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(""); }} placeholder="••••••••••" autoComplete="new-password" />
            <Input type="password" label="Confirm new password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()} error={error} placeholder="•••••••••" autoComplete="new-password" />
            <Button onClick={onSubmit} loading={loading} disabled={!oldPassword || !newPassword || !confirmPassword}>
              Change password
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
