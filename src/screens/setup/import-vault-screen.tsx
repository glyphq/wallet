import { useState } from "react";
import { useNavigate } from "react-router";
import { KeyMinimalistic, Wallet } from "@solar-icons/react";
import { Identicon } from "@/components/identicon";
import { Input } from "@/components/input";
import { PasswordFields, passwordsAreValid, SetupFlow } from "@/components/setup-flow";
import { Textarea } from "@/components/textarea";
import { FullPage } from "@/layouts/full-page";
import { deriveIdentityFromSeed, InvalidSeedError, newId, toSeed, type Seed } from "@/lib/crypto";
import { truncateId } from "@/lib/format";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault } from "@/lib/vault";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

type Step = 1 | 2 | 3;

export default function ImportVaultScreen() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((state) => state.addVault);
  const setActiveVault = usePersistedStore((state) => state.setActiveVault);
  const unlock = useSessionStore((state) => state.unlock);

  const [step, setStep] = useState<Step>(1);
  const [seedInput, setSeedInput] = useState("");
  const [seed, setSeed] = useState<Seed | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [nameError, setNameError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordValid = passwordsAreValid(password, confirmPassword);

  function back() {
    if (step === 1) navigate("/setup");
    else setStep((step - 1) as Step);
  }

  function validateSeed() {
    try {
      const parsed = toSeed(seedInput.trim().toLowerCase());
      setSeed(parsed);
      setIdentity(deriveIdentityFromSeed(parsed));
      setSeedError("");
      setStep(2);
    } catch (error) {
      setSeedError(error instanceof InvalidSeedError ? "Enter exactly 55 lowercase letters" : "This seed is not valid");
    }
  }

  function continueFromName() {
    if (!name.trim()) {
      setNameError("Enter a wallet name");
      return;
    }
    setNameError("");
    setStep(3);
  }

  async function finish() {
    if (!seed || !passwordValid || loading) return;
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
          identity: identity ?? undefined,
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
        <SetupFlow current={1} total={3} title="Enter your seed" primaryLabel="Continue" onPrimary={validateSeed} onBack={back}>
          <Textarea
            leftElement={<KeyMinimalistic size={18} weight="Linear" />}
            value={seedInput}
            onChange={(event) => {
              setSeedInput(event.target.value);
              setSeedError("");
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") validateSeed();
            }}
            placeholder="55 lowercase letters"
            aria-label="Recovery seed"
            autoCapitalize="none"
            autoFocus
            technical
            error={seedError}
            style={{ resize: "none", minHeight: 136, borderRadius: "var(--radius-control)", background: "var(--color-bg-input)", overflowWrap: "anywhere" }}
          />
        </SetupFlow>
      ) : null}

      {step === 2 ? (
        <SetupFlow current={2} total={3} title="Name your wallet" primaryLabel="Continue" onPrimary={continueFromName} onBack={back}>
          {identity ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-3) 0",
                borderTop: "1px solid var(--color-border-subtle)",
                borderBottom: "1px solid var(--color-border-subtle)",
              }}
            >
              <Identicon seed={identity} size={40} radius={8} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)" }}>
                {truncateId(identity, 10, 10)}
              </span>
            </div>
          ) : null}
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

      {step === 3 ? (
        <SetupFlow
          current={3}
          total={3}
          title="Set a password"
          primaryLabel="Restore wallet"
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
