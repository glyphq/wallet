import { useState } from "react";
import { recordAuditEvent } from "@/lib/audit-log";
import { createSignedExportEnvelope } from "@/lib/export-format";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-strength";
import { saveFileDialog } from "@/lib/save-file";
import { exportWallet, rotateWalletPassword, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

/** Wallet-wide export and password rotation flows for one wallet. */
export function useWalletAdmin(wallet: WalletMeta | undefined, isActive: boolean) {
  const updateWallet = usePersistedStore((s) => s.updateWallet);
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
    if (!wallet || !wallet.encryptedData) return;
    const envelope = await createSignedExportEnvelope("wallet", {
      glyph: 1,
      name: wallet.name,
      color: wallet.color,
      accounts: wallet.accounts,
      exported_at: Date.now(),
      wallet: JSON.parse(exportWallet(wallet.encryptedData)),
    });
    const data = JSON.stringify(envelope, null, 2);
    const defaultName = `glyph-${wallet.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wallet"}.json`;
    const saved = await saveFileDialog(defaultName, data);
    if (saved) {
      recordAuditEvent({
        kind: "wallet_exported",
        status: "success",
        title: "Wallet exported",
        detail: `${wallet.name} saved as signed export v2`,
        walletId: wallet.id,
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
    if (!wallet || !rotateOldPassword || !rotateNewPassword) return;
    if (rotateNewPassword !== rotateConfirm) { setRotateError("Passwords do not match"); return; }
    if (rotateNewPassword.length < MIN_PASSWORD_LENGTH) { setRotateError(`Password too short (min ${MIN_PASSWORD_LENGTH} chars)`); return; }
    setRotateLoading(true);
    setRotateError("");
    try {
      const newEncrypted = await rotateWalletPassword(wallet.encryptedData!, rotateOldPassword, rotateNewPassword);
      updateWallet(wallet.id, { encryptedData: newEncrypted });
      if (isActive) {
        const wallets = await unlockWalletSession(newEncrypted, rotateNewPassword);
        sessionUnlock(wallet.id, wallets);
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
