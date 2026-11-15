import { useState } from "react";
import { recordAuditEvent } from "@/lib/audit-log";
import { createSignedExportEnvelope } from "@/lib/export-format";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-strength";
import { saveFileDialog } from "@/lib/save-file";
import { exportVault, rotateVaultPassword, unlockVaultSession } from "@/lib/vault";
import { usePersistedStore, type VaultMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

/** Vault-wide export and password rotation flows for one vault. */
export function useVaultAdmin(vault: VaultMeta | undefined, isActive: boolean) {
  const updateVault = usePersistedStore((s) => s.updateVault);
  const sessionUnlock = useSessionStore((s) => s.unlock);

  const [showExport, setShowExport] = useState(false);
  const [showRotate, setShowRotate] = useState(false);
  const [rotateOldPassword, setRotateOldPassword] = useState("");
  const [rotateNewPassword, setRotateNewPassword] = useState("");
  const [rotateConfirm, setRotateConfirm] = useState("");
  const [rotateError, setRotateError] = useState("");
  const [rotateLoading, setRotateLoading] = useState(false);
  const [rotateDone, setRotateDone] = useState(false);

  async function doExport() {
    if (!vault || !vault.encryptedData) return;
    const envelope = await createSignedExportEnvelope("vault", {
      glyph: 1,
      name: vault.name,
      color: vault.color,
      accounts: vault.accounts,
      exported_at: Date.now(),
      vault: JSON.parse(exportVault(vault.encryptedData)),
    });
    const data = JSON.stringify(envelope, null, 2);
    const defaultName = `glyph-${vault.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "vault"}.json`;
    const saved = await saveFileDialog(defaultName, data);
    if (saved) {
      recordAuditEvent({
        kind: "vault_exported",
        status: "success",
        title: "Vault exported",
        detail: `${vault.name} saved as signed export v2`,
        vaultId: vault.id,
      });
      setShowExport(false);
    }
  }

  function openRotate() {
    setShowRotate(true);
    setRotateDone(false);
    setRotateError("");
  }

  async function doRotatePassword() {
    if (!vault || !rotateOldPassword || !rotateNewPassword) return;
    if (rotateNewPassword !== rotateConfirm) { setRotateError("Passwords do not match"); return; }
    if (rotateNewPassword.length < MIN_PASSWORD_LENGTH) { setRotateError(`Password too short (min ${MIN_PASSWORD_LENGTH} chars)`); return; }
    setRotateLoading(true);
    setRotateError("");
    try {
      const newEncrypted = await rotateVaultPassword(vault.encryptedData!, rotateOldPassword, rotateNewPassword);
      updateVault(vault.id, { encryptedData: newEncrypted });
      if (isActive) {
        const wallets = await unlockVaultSession(newEncrypted, rotateNewPassword);
        sessionUnlock(vault.id, wallets);
      }
      setRotateDone(true);
      setRotateOldPassword("");
      setRotateNewPassword("");
      setRotateConfirm("");
    } catch {
      setRotateError("Wrong password");
    } finally {
      setRotateLoading(false);
    }
  }

  return {
    showExport,
    setShowExport,
    doExport,
    showRotate,
    setShowRotate,
    rotateOldPassword,
    setRotateOldPassword,
    rotateNewPassword,
    setRotateNewPassword,
    rotateConfirm,
    setRotateConfirm,
    rotateError,
    setRotateError,
    rotateLoading,
    rotateDone,
    openRotate,
    doRotatePassword,
  };
}
