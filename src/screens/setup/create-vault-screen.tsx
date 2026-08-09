import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, Eye, EyeClosed, KeyMinimalistic, Wallet } from "@solar-icons/react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { PasswordFields, passwordsAreValid, SeedSurface, SetupFlow } from "@/components/setup-flow";
import { Textarea } from "@/components/textarea";
import { FullPage } from "@/layouts/full-page";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_AUTO_HIDE_MS, SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { deriveIdentityFromSeed, generateRandomSeed, newId, type Seed } from "@/lib/crypto";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault } from "@/lib/vault";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

type Step = 1 | 2 | 3 | 4;

export default function CreateVaultScreen() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((state) => state.addVault);
  const setActiveVault = usePersistedStore((state) => state.setActiveVault);
  const unlock = useSessionStore((state) => state.unlock);

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [seed] = useState<Seed>(() => generateRandomSeed());
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [backupSeedRevealed, setBackupSeedRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSegment, setCopiedSegment] = useState<number | null>(null);
  const [seedViewed, setSeedViewed] = useState(false);
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

  const passwordValid = passwordsAreValid(password, confirmPassword);
  const normalizedConfirmation = confirmation.trim().toLowerCase();

  function back() {
    if (step === 1) navigate("/setup");
    else setStep((step - 1) as Step);
  }

  function continueFromName() {
    if (!name.trim()) {
      setNameError("Enter a Vault name");
      return;
    }
    setNameError("");
    setBackupSeedRevealed(false);
    setSeedViewed(false);
    setStep(2);
  }

  function toggleBackupSeed() {
    setBackupSeedRevealed((revealed) => {
      if (!revealed) setSeedViewed(true);
      return !revealed;
    });
  }

  async function copySeed() {
    const didCopy = await copyToClipboard(seed, SEED_CLIPBOARD_CLEAR_SECS);
    if (!didCopy) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function copySeedSegment(segment: string, index: number) {
    const didCopy = await copyToClipboard(segment, SEED_CLIPBOARD_CLEAR_SECS);
    if (!didCopy) return;
    setCopiedSegment(index);
    window.setTimeout(() => setCopiedSegment((current) => current === index ? null : current), 1500);
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

  return (
    <FullPage centered={false} style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      {step === 1 ? (
        <SetupFlow current={1} total={4} title="Name your Vault" primaryLabel="Continue" onPrimary={continueFromName} onBack={back}>
          <Input
            leftElement={<Wallet size={18} weight="Linear" />}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError("");
            }}
            onKeyDown={(event) => event.key === "Enter" && continueFromName()}
            placeholder="Vault name"
            aria-label="Vault name"
            autoFocus
            error={nameError}
          />
        </SetupFlow>
      ) : null}

      {step === 2 ? (
        <SetupFlow
          current={2}
          total={4}
          title="Back up your seed"
          primaryLabel="Continue"
          primaryDisabled={!acknowledged || !seedViewed}
          onPrimary={continueFromBackup}
          onBack={back}
          secondaryActions={
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <Button variant="secondary" size="md" onClick={copySeed}>{copied ? "Copied" : "Copy seed"}</Button>
              <Button variant="secondary" size="md" onClick={toggleBackupSeed} aria-pressed={backupSeedRevealed}>
                {backupSeedRevealed ? <EyeClosed size={18} weight="Linear" aria-hidden="true" /> : <Eye size={18} weight="Linear" aria-hidden="true" />}
                {backupSeedRevealed ? "Hide seed" : "Reveal seed"}
              </Button>
            </div>
          }
        >
          <p style={{ margin: 0, fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
            Your seed stays hidden until you choose to reveal it. Write it down offline, then confirm it on the next step.
          </p>
          <SeedSurface
            seed={seed}
            revealed={backupSeedRevealed}
            copiedIndex={copiedSegment}
            onCopySegment={copySeedSegment}
          />
          <button
            type="button"
            role="checkbox"
            aria-checked={acknowledged}
            onClick={() => setAcknowledged((value) => !value)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              minHeight: 48,
              padding: "0 var(--space-1)",
              border: 0,
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: "0.875rem",
              color: "var(--color-text-primary)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
                border: `1px solid ${acknowledged ? "var(--color-text-primary)" : "var(--color-border-strong)"}`,
                borderRadius: 7,
                background: acknowledged ? "var(--color-text-primary)" : "var(--color-bg-surface-2)",
                color: "var(--color-text-inverse)",
                transition: "background-color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
              }}
            >
              {acknowledged ? <CheckCircle size={16} weight="Bold" /> : null}
            </span>
            I wrote this seed down and stored it safely
          </button>
        </SetupFlow>
      ) : null}

      {step === 3 ? (
        <SetupFlow
          current={3}
          total={4}
          title="Confirm your backup"
          primaryLabel="Continue"
          primaryDisabled={!confirmation.trim()}
          onPrimary={confirmBackup}
          onBack={back}
        >
          <p style={{ margin: 0, fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
            Type the complete seed exactly as you saved it.
          </p>
          <Textarea
            leftElement={<KeyMinimalistic size={18} weight="Linear" />}
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setConfirmationError("");
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") confirmBackup();
            }}
            placeholder="Enter the complete seed"
            aria-label="Complete recovery seed"
            technical
            autoFocus
            error={confirmationError}
            style={{ resize: "none", minHeight: 136, borderRadius: "var(--radius-control)", background: "var(--color-bg-input)", overflowWrap: "anywhere" }}
          />
        </SetupFlow>
      ) : null}

      {step === 4 ? (
        <SetupFlow
          current={4}
          total={4}
          title="Set a password"
          primaryLabel="Create Vault"
          primaryDisabled={!passwordValid}
          primaryLoading={loading}
          onPrimary={finish}
          onBack={back}
          error={setupError}
        >
          <PasswordFields
            password={password}
            confirmPassword={confirmPassword}
            visible={passwordsVisible}
            onPasswordChange={setPassword}
            onConfirmChange={setConfirmPassword}
            onToggleVisibility={() => setPasswordsVisible((value) => !value)}
            onSubmit={finish}
          />
        </SetupFlow>
      ) : null}
    </FullPage>
  );
}
