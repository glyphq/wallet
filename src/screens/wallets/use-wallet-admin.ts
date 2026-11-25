import { useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-strength";
import { rotateWalletPassword, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

/** Wallet password rotation flow for one wallet. */
export function useWalletAdmin(wallet: WalletMeta | undefined, isActive: boolean) {
  const updateWallet = usePersistedStore((s) => s.updateWallet);
  const sessionUnlock = useSessionStore((s) => s.unlock);

  const [showRotate, setShowRotate] = useState(false);
  const [rotateOldPassword, setRotateOldPassword] = useState("");
  const [rotateNewPassword, setRotateNewPassword] = useState("");
  const [rotateConfirm, setRotateConfirm] = useState("");
  const [rotateError, setRotateError] = useState("");
  const [rotateLoading, setRotateLoading] = useState(false);
  const [rotateDone, setRotateDone] = useState(false);

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
