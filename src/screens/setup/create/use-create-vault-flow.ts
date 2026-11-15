import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { passwordsAreValid } from "@/components/setup-flow";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_AUTO_HIDE_MS, SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { deriveIdentityFromSeed, generateRandomSeed, newId, type Seed } from "@/lib/crypto";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault } from "@/lib/vault";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

export type CreateVaultStep = 1 | 2 | 3 | 4;

/** State machine for the four-step create-Vault flow: name, seed backup, seed confirmation, password. */
export function useCreateVaultFlow() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((state) => state.addVault);
  const setActiveVault = usePersistedStore((state) => state.setActiveVault);
  const unlock = useSessionStore((state) => state.unlock);

  const [step, setStep] = useState<CreateVaultStep>(1);
  const [name, setName] = useState("");
  const [seed] = useState<Seed>(() => generateRandomSeed());
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [backupSeedRevealed, setBackupSeedRevealed] = useState(false);
  const [backupSeedHandled, setBackupSeedHandled] = useState(false);
  const [confirmationRevealed, setConfirmationRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [nameError, setNameError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== 2 || !backupSeedRevealed) return;
    const timer = window.setTimeout(() => setBackupSeedRevealed(false), SEED_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [backupSeedRevealed, step]);

  const normalizedConfirmation = confirmation.trim().toLowerCase();
  const passwordValid = passwordsAreValid(password, confirmPassword);

  function back() {
    if (step === 1) navigate("/setup");
    else setStep((step - 1) as CreateVaultStep);
  }

  function continueFromName() {
    if (!name.trim()) {
      setNameError("Enter a Vault name");
      return;
    }
    setNameError("");
    setBackupSeedRevealed(false);
    setBackupSeedHandled(false);
    setStep(2);
  }

  function toggleBackupSeed() {
    setBackupSeedRevealed((revealed) => {
      if (!revealed) setBackupSeedHandled(true);
      return !revealed;
    });
  }

  async function copySeed() {
    const didCopy = await copyToClipboard(seed, SEED_CLIPBOARD_CLEAR_SECS);
    if (!didCopy) return;
    setBackupSeedHandled(true);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function confirmBackup() {
    if (normalizedConfirmation !== seed) {
      setConfirmationError("The seed does not match");
      return;
    }
    setConfirmationError("");
    setStep(4);
  }

  function continueFromBackup() {
    setBackupSeedRevealed(false);
    setConfirmationRevealed(false);
    setStep(3);
  }

  async function finish() {
    if (!passwordValid || loading) return;
    setSetupError("");
    setLoading(true);
    try {
      const encryptedData = await createVault(password, [seed]);
      const now = Date.now();
      const vault = {
        id: newId(),
        name: name.trim(),
        color: DEFAULT_WALLET_COLOR,
        icon: DEFAULT_WALLET_ICON,
        kind: "seeded" as const,
        createdAt: now,
        lastUnlockedAt: now,
        accounts: [{
          index: 0,
          name: "Account 1",
          addedAt: now,
          hidden: false,
          identity: deriveIdentityFromSeed(seed),
          note: "",
          tags: [],
        }],
        encryptedData,
      };
      const wallets = await unlockSecureSession([seed]);
      addVault(vault);
      setActiveVault(vault.id);
      unlock(vault.id, wallets);
      navigate("/dashboard", { replace: true });
    } catch {
      setSetupError("Vault setup could not be completed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return {
    step,
    name,
    setName,
    nameError,
    setNameError,
    seed,
    confirmation,
    setConfirmation,
    confirmationError,
    setConfirmationError,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    passwordsVisible,
    togglePasswordsVisible: () => setPasswordsVisible((value) => !value),
    backupSeedRevealed,
    backupSeedHandled,
    copied,
    acknowledged,
    toggleAcknowledged: () => setAcknowledged((value) => !value),
    confirmationRevealed,
    toggleConfirmationRevealed: () => setConfirmationRevealed((value) => !value),
    setupError,
    loading,
    passwordValid,
    back,
    continueFromName,
    toggleBackupSeed,
    copySeed,
    confirmBackup,
    continueFromBackup,
    finish,
  };
}

export type CreateVaultFlow = ReturnType<typeof useCreateVaultFlow>;
