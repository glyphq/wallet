import { useEffect, useRef, useState } from "react";
import { recordAuditEvent } from "@/lib/audit-log";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { toSeed } from "@/lib/crypto";
import { requiresBiometricSeedReveal } from "@/lib/session-policies";
import { revealWalletSeed } from "@/lib/wallet";
import { usePersistedStore, type AccountMeta, type WalletMeta } from "@/store/persisted";

/** Seed reveal, countdown, and backup-verification state for one wallet. */
export function useSeedReveal(wallet: WalletMeta | undefined) {
  const biometricWalletIds = usePersistedStore((s) => s.settings.biometricWalletIds) ?? [];
  const requireBiometricForSeedReveal = usePersistedStore((s) => s.settings.requireBiometricForSeedReveal);

  const [revealingAccount, setRevealingAccount] = useState<AccountMeta | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealError, setRevealError] = useState("");
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealedSeed, setRevealedSeed] = useState("");
  const [seedVisible, setSeedVisible] = useState(true);
  const [seedCopied, setSeedCopied] = useState(false);
  const [seedSecsLeft, setSeedSecsLeft] = useState(0);
  const [verifyingBackup, setVerifyingBackup] = useState(false);
  const [backupCheck, setBackupCheck] = useState("");
  const [backupCheckStatus, setBackupCheckStatus] = useState<"idle" | "match" | "mismatch">("idle");
  const seedCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const biometricRevealRequired = wallet
    ? requiresBiometricSeedReveal(requireBiometricForSeedReveal, biometricWalletIds, wallet.id)
    : false;

  useEffect(() => {
    if (!revealedSeed) return;
    setSeedSecsLeft(SEED_CLIPBOARD_CLEAR_SECS);
    const dismiss = setTimeout(() => {
      setRevealedSeed("");
      setSeedCopied(false);
      setRevealingAccount(null);
      setRevealPassword("");
    }, SEED_CLIPBOARD_CLEAR_SECS * 1000);
    seedCountdownRef.current = setInterval(() => {
      setSeedSecsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      clearTimeout(dismiss);
      if (seedCountdownRef.current) clearInterval(seedCountdownRef.current);
    };
  }, [revealedSeed]);

  function openReveal(account: AccountMeta) {
    setRevealingAccount(account);
    setRevealPassword("");
    setRevealError("");
    setRevealLoading(false);
    setRevealedSeed("");
    setSeedVisible(true);
    setSeedCopied(false);
    setVerifyingBackup(false);
    setBackupCheck("");
    setBackupCheckStatus("idle");
  }

  function openBackupVerification() {
    if (!wallet) return;
    const firstAccount = wallet.accounts.find((account) => account.index === 0) ?? wallet.accounts[0];
    if (!firstAccount) return;
    openReveal(firstAccount);
    setSeedVisible(false);
    setVerifyingBackup(true);
  }

  async function doRevealSeed() {
    if (!wallet || !revealingAccount) return;
    setRevealLoading(true);
    setRevealError("");
    try {
      let seeds;
      if (biometricRevealRequired) {
        const { invoke } = await import("@tauri-apps/api/core");
        const seed = await invoke<string>("reveal_seed_with_biometric", {
          walletId: wallet.id,
          walletData: wallet.encryptedData!,
          accountIndex: revealingAccount.index,
        });
        seeds = [];
        seeds[revealingAccount.index] = toSeed(seed);
      } else {
        const seed = await revealWalletSeed(wallet.encryptedData!, revealPassword, revealingAccount.index);
        seeds = [];
        seeds[revealingAccount.index] = toSeed(seed);
      }
      const seed = seeds[revealingAccount.index];
      if (!seed) throw new Error("Missing seed");
      setRevealedSeed(seed);
      if (!verifyingBackup) setSeedVisible(true);
      setRevealPassword("");
      recordAuditEvent({
        kind: "seed_revealed",
        status: "success",
        title: "Seed revealed",
        detail: `${revealingAccount.name} in ${wallet.name}`,
        walletId: wallet.id,
        accountIndex: revealingAccount.index,
      });
    } catch {
      setRevealError("Wrong password");
    } finally {
      setRevealLoading(false);
    }
  }

  async function copyRevealedSeed() {
    if (!revealedSeed) return;
    await copyToClipboard(revealedSeed, SEED_CLIPBOARD_CLEAR_SECS);
    setSeedCopied(true);
  }

  function verifyBackupSeed() {
    if (!revealedSeed) return;
    setBackupCheckStatus(backupCheck.trim().toLowerCase() === revealedSeed ? "match" : "mismatch");
  }

  return {
    revealingAccount,
    setRevealingAccount,
    revealPassword,
    setRevealPassword,
    revealError,
    setRevealError,
    revealLoading,
    revealedSeed,
    seedVisible,
    setSeedVisible,
    seedCopied,
    seedSecsLeft,
    verifyingBackup,
    backupCheck,
    setBackupCheck,
    backupCheckStatus,
    setBackupCheckStatus,
    biometricRevealRequired,
    openReveal,
    openBackupVerification,
    doRevealSeed,
    copyRevealedSeed,
    verifyBackupSeed,
  };
}
