import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  AltArrowLeft,
  AltArrowRight,
  Eye,
  EyeClosed,
  LockKeyhole,
} from "@solar-icons/react";
import { stepMotion } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
import { Input } from "@/components/input";
import { StepProgress } from "@/components/step-progress";
import { WalletAppearancePicker } from "@/components/wallet-appearance-picker";
import { deriveIdentityFromSeed, InvalidSeedError, newId, toSeed, type Seed } from "@/lib/crypto";
import { truncateId } from "@/lib/format";
import { DEFAULT_WALLET_COLOR, DEFAULT_WALLET_ICON } from "@/lib/wallet-appearance";
import { passwordStrength } from "@/lib/password-strength";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault } from "@/lib/vault";
import { usePersistedStore, type VaultColor, type WalletIconId } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

type Step = 1 | 2 | 3;

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  border: "1px solid var(--color-border-default)",
  borderRadius: "var(--radius-sheet)",
  padding: "var(--space-5)",
};

function PasswordVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? "Hide passwords" : "Show passwords"}
      aria-pressed={visible}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-tertiary)",
        cursor: "pointer",
      }}
    >
      {visible ? <EyeClosed size={18} weight="Outline" /> : <Eye size={18} weight="Outline" />}
    </button>
  );
}

function PasswordStrengthMeter({ level, label, color }: { level: number; label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", gap: "var(--space-1)", flex: 1 }}>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 999,
              background: index <= level ? color : "var(--color-border-default)",
              transition: "background-color var(--duration-fast) var(--ease-standard)",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-label)",
          fontWeight: 500,
          color,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function ImportVaultScreen() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((s) => s.addVault);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const unlock = useSessionStore((s) => s.unlock);

  const [step, setStep] = useState<Step>(1);
  const [seedInput, setSeedInput] = useState("");
  const [seed, setSeed] = useState<Seed | null>(null);
  const [derivedIdentity, setDerivedIdentity] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [walletIcon, setWalletIcon] = useState<WalletIconId>(DEFAULT_WALLET_ICON);
  const [walletColor, setWalletColor] = useState<VaultColor>(DEFAULT_WALLET_COLOR);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [nameError, setNameError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit = password.length >= 10 && strength.level >= 1 && confirmPassword.length > 0 && passwordsMatch;

  function validateAndContinue() {
    try {
      const parsedSeed = toSeed(seedInput.trim().toLowerCase());
      setSeed(parsedSeed);
      setDerivedIdentity(deriveIdentityFromSeed(parsedSeed));
      setSeedError("");
      setStep(2);
    } catch (error) {
      setSeedError(error instanceof InvalidSeedError ? "Enter exactly 55 lowercase letters" : "Invalid seed phrase. Check your input and try again.");
    }
  }

  function goStep3() {
    if (!name.trim()) {
      setNameError("Please enter a wallet name");
      return;
    }
    setNameError("");
    setStep(3);
  }

  async function finish() {
    if (!seed || !canSubmit) return;
    setSetupError("");
    setLoading(true);
    try {
      const encryptedData = await createVault(password, [seed]);
      const vault = {
        id: newId(),
        name: name.trim(),
        color: walletColor,
        icon: walletIcon,
        kind: "seeded" as const,
        createdAt: Date.now(),
        lastUnlockedAt: Date.now(),
        accounts: [{
          index: 0,
          name: "Account 1",
          addedAt: Date.now(),
          hidden: false,
          identity: derivedIdentity ?? undefined,
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
    <FullPage centered={false} style={{ justifyContent: "flex-start", paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          margin: "0 auto",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <BrandLockup align="center" compact subtitle="Import an existing encrypted seed" />
        <StepProgress current={step} total={3} />

        {step === 1 ? (
          <motion.div {...stepMotion} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "var(--space-1)" }}>
              <FlowHeader
                align="center"
                title="Enter your seed"
              />

              <Input
                label="Seed phrase"
                technical
                type="password"
                value={seedInput}
                onChange={(event) => {
                  setSeedInput(event.target.value);
                  if (seedError) setSeedError("");
                }}
                onKeyDown={(event) => event.key === "Enter" && validateAndContinue()}
                placeholder="55 lowercase letters"
                autoCapitalize="none"
                autoFocus
                error={seedError}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flexShrink: 0 }}>
              <Button onClick={validateAndContinue}>
                Continue
                <AltArrowRight size={16} weight="Outline" />
              </Button>
              <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => navigate("/setup")}>
                <AltArrowLeft size={16} weight="Outline" />
                Back
              </Button>
            </div>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div {...stepMotion} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "var(--space-1)" }}>
              <FlowHeader
                align="center"
                title="Name your wallet"
              />

              {derivedIdentity ? (
                <div style={cardStyle}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-caption)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    Derived identity
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-mono-lg)",
                      lineHeight: 1.6,
                      color: "var(--color-text-primary)",
                      wordBreak: "break-all",
                    }}
                  >
                    {truncateId(derivedIdentity, 12, 12)}
                  </span>
                </div>
                </div>
              ) : null}

              <Input
                label="Wallet name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError("");
                }}
                onKeyDown={(event) => event.key === "Enter" && goStep3()}
                placeholder="Main, trading, cold storage"
                autoFocus
                error={nameError}
              />

              <WalletAppearancePicker
                icon={walletIcon}
                color={walletColor}
                onIconChange={setWalletIcon}
                onColorChange={setWalletColor}
              />
            </div>

            <div style={{ flexShrink: 0 }}>
              <Button onClick={goStep3}>
                Continue
                <AltArrowRight size={16} weight="Outline" />
              </Button>
            </div>
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div {...stepMotion} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "var(--space-1)" }}>
              <FlowHeader
                align="center"
                title="Set a password"
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Input
                label="Password"
                type={passwordsVisible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && !loading && canSubmit && finish()}
                placeholder="Enter a wallet password"
                autoComplete="new-password"
                autoFocus
                rightElement={<PasswordVisibilityButton visible={passwordsVisible} onToggle={() => setPasswordsVisible((visible) => !visible)} />}
              />

              <Input
                label="Confirm password"
                type={passwordsVisible ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && !loading && canSubmit && finish()}
                placeholder="Re-enter the password"
                autoComplete="new-password"
                error={confirmPassword.length > 0 && !passwordsMatch ? "Passwords do not match." : undefined}
              />

                {password.length > 0 ? <PasswordStrengthMeter level={strength.level} label={strength.label} color={strength.color} /> : null}
              </div>

              {setupError ? (
                <div
                  role="alert"
                  style={{
                    padding: "var(--space-4)",
                    border: "1px solid color-mix(in srgb, var(--color-status-error) 45%, transparent)",
                    borderRadius: "var(--radius-surface)",
                    background: "color-mix(in srgb, var(--color-status-error) 10%, var(--color-bg-surface))",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-body-compact)",
                    lineHeight: "var(--leading-body)",
                    color: "var(--color-status-error)",
                  }}
                >
                  {setupError}
                </div>
              ) : null}
            </div>

            <div style={{ flexShrink: 0 }}>
              <Button onClick={finish} disabled={loading || !canSubmit} loading={loading}>
                <LockKeyhole size={16} weight="Outline" />
                Import wallet
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </FullPage>
  );
}
