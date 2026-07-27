import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle, KeyMinimalistic, Wallet } from "@solar-icons/react";
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
  const [seedRevealed, setSeedRevealed] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedSegment, setCopiedSegment] = useState<number | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [nameError, setNameError] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== 2) return;
    setSeedRevealed(true);
    const timer = window.setTimeout(() => setSeedRevealed(false), SEED_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  const passwordValid = passwordsAreValid(password, confirmPassword);
  const normalizedConfirmation = confirmation.trim().toLowerCase();

  function back() {
    if (step === 1) navigate("/setup");
    else setStep((step - 1) as Step);
  }

  function continueFromName() {
    if (!name.trim()) {
      setNameError("Enter a wallet name");
      return;
    }
    setNameError("");
    setStep(2);
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
      setSetupError("Wallet setup could not be completed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FullPage centered={false} style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      {step === 1 ? (
        <SetupFlow current={1} total={4} title="Name your wallet" primaryLabel="Continue" onPrimary={continueFromName} onBack={back}>
          <Input
            leftElement={<Wallet size={18} weight="Linear" />}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError("");
            }}
            onKeyDown={(event) => event.key === "Enter" && continueFromName()}
            placeholder="Wallet name"
            aria-label="Wallet name"
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
          primaryDisabled={!acknowledged}
          onPrimary={() => setStep(3)}
          onBack={back}
          secondaryActions={
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <Button variant="secondary" size="md" onClick={copySeed}>{copied ? "Copied" : "Copy seed"}</Button>
              <Button variant="secondary" size="md" onClick={() => setSeedRevealed((value) => !value)}>{seedRevealed ? "Hide" : "Reveal"}</Button>
            </div>
          }
        >
          <SeedSurface
            seed={seed}
            revealed={seedRevealed}
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
            I saved this seed safely
          </button>
        </SetupFlow>
      ) : null}

      {step === 3 ? (
        <SetupFlow
          current={3}
          total={4}
          title="Confirm your backup"
          primaryLabel="Continue"
          onPrimary={confirmBackup}
          onBack={back}
        >
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
          primaryLabel="Create wallet"
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
