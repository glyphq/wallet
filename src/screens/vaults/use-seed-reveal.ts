import { useEffect, useRef, useState } from "react";
import { recordAuditEvent } from "@/lib/audit-log";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { toSeed } from "@/lib/crypto";
import { requiresBiometricSeedReveal } from "@/lib/session-policies";
import { revealVaultSeed } from "@/lib/vault";
import { usePersistedStore, type AccountMeta, type VaultMeta } from "@/store/persisted";

/** Seed reveal, countdown, and backup-verification state for one vault. */
export function useSeedReveal(vault: VaultMeta | undefined) {
  const biometricVaultIds = usePersistedStore((s) => s.settings.biometricVaultIds) ?? [];
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

  const biometricRevealRequired = vault
    ? requiresBiometricSeedReveal(requireBiometricForSeedReveal, biometricVaultIds, vault.id)
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
    if (!vault) return;
    const firstAccount = vault.accounts.find((account) => account.index === 0) ?? vault.accounts[0];
    if (!firstAccount) return;
    openReveal(firstAccount);
    setSeedVisible(false);
    setVerifyingBackup(true);
  }

  async function doRevealSeed() {
    if (!vault || !revealingAccount) return;
    setRevealLoading(true);
    setRevealError("");
    try {
      let seeds;
      if (biometricRevealRequired) {
        const { invoke } = await import("@tauri-apps/api/core");
        const seed = await invoke<string>("reveal_seed_with_biometric", {
          vaultId: vault.id,
          vaultData: vault.encryptedData!,
          accountIndex: revealingAccount.index,
        });
        seeds = [];
        seeds[revealingAccount.index] = toSeed(seed);
      } else {
        const seed = await revealVaultSeed(vault.encryptedData!, revealPassword, revealingAccount.index);
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
        detail: `${revealingAccount.name} in ${vault.name}`,
        vaultId: vault.id,
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
