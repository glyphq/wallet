import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  AltArrowLeft,
  AltArrowRight,
  CheckCircle,
  Copy,
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
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_AUTO_HIDE_MS, SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import { deriveIdentityFromSeed, generateRandomSeed, newId, type Seed } from "@/lib/crypto";
import { passwordStrength } from "@/lib/password-strength";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault } from "@/lib/vault";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

type Step = 1 | 2 | 3 | 4;

function pickCheckPositions(seed: string, count = 4): number[] {
  const positions = new Set<number>();
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * seed.length));
  }
  return Array.from(positions).sort((a, b) => a - b);
}

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

export default function CreateVaultScreen() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((s) => s.addVault);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const unlock = useSessionStore((s) => s.unlock);

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [seed] = useState<Seed>(() => generateRandomSeed());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [nameError, setNameError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkPositions] = useState<number[]>(() => pickCheckPositions(seed));
  const [checkInputs, setCheckInputs] = useState(["", "", "", ""]);
  const checkRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [seedRevealed, setSeedRevealed] = useState(true);

  useEffect(() => {
    if (step !== 2) return;
    setSeedRevealed(true);
    const timer = setTimeout(() => setSeedRevealed(false), SEED_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [step]);

  const checkComplete = checkPositions.every((pos, index) => checkInputs[index] === seed[pos]);
  const strength = passwordStrength(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit = password.length >= 10 && strength.level >= 1 && confirmPassword.length > 0 && passwordsMatch;

  function goStep2() {
    if (!name.trim()) {
      setNameError("Please enter a wallet name");
      return;
    }
    setNameError("");
    setStep(2);
  }

  async function copySeed() {
    await copyToClipboard(seed, SEED_CLIPBOARD_CLEAR_SECS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCheckInput(index: number, raw: string) {
    const value = raw.slice(-1).toLowerCase();
    setCheckInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value) checkRefs.current[index + 1]?.focus();
  }

  function handleCheckKey(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !checkInputs[index]) {
      checkRefs.current[index - 1]?.focus();
    }
  }

  async function finish() {
    if (!canSubmit) return;
    setSetupError("");
    setLoading(true);
    try {
      const encryptedData = await createVault(password, [seed]);
      const vault = {
        id: newId(),
        name: name.trim(),
        color: "slate" as const,
        kind: "seeded" as const,
        createdAt: Date.now(),
        lastUnlockedAt: Date.now(),
        accounts: [{
          index: 0,
          name: "Account 1",
          addedAt: Date.now(),
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
        <BrandLockup align="center" compact subtitle="Create a new encrypted wallet" />
        <StepProgress current={step} total={4} />

        {step === 1 ? (
          <motion.div {...stepMotion} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "var(--space-1)" }}>
              <FlowHeader
                align="center"
                title="Name your wallet"
              />

              <Input
                label="Wallet name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError("");
                }}
                onKeyDown={(event) => event.key === "Enter" && goStep2()}
                placeholder="Main, trading, cold storage"
                autoFocus
                error={nameError}
              />

            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flexShrink: 0 }}>
              <Button onClick={goStep2}>
                Continue
                <AltArrowRight size={16} weight="Bold" />
              </Button>
              <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => navigate("/setup")}>
                <AltArrowLeft size={16} weight="Bold" />
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
                title="Back up your seed"
              />

              <div style={cardStyle}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  marginBottom: "var(--space-4)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-caption)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  Recovery seed
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-caption)",
                    color: "var(--color-status-warning)",
                  }}
                >
                  Clipboard clears in 30 seconds
                </span>
              </div>

              <div
                style={{
                  position: "relative",
                  background: "var(--color-bg-canvas)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "var(--radius-surface)",
                  padding: "var(--space-4)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-mono-lg)",
                    lineHeight: 1.9,
                    letterSpacing: "0.06em",
                    color: seedRevealed ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                    wordBreak: "break-all",
                    filter: seedRevealed ? "none" : "blur(6px)",
                    userSelect: seedRevealed ? "text" : "none",
                    transition: "filter var(--duration-fast) var(--ease-standard)",
                  }}
                  aria-hidden={!seedRevealed}
                >
                  {seedRevealed
                    ? seed.split("").map((char, index) => (
                        <span key={index}>
                          {char}
                          {(index + 1) % 5 === 0 && index < seed.length - 1 ? " " : ""}
                        </span>
                      ))
                    : "•".repeat(Math.max(seed.length + Math.floor(seed.length / 5), 12))}
                </div>
                {!seedRevealed ? (
                  <button
                    type="button"
                    onClick={() => setSeedRevealed(true)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: "none",
                      background: "transparent",
                      borderRadius: "var(--radius-surface)",
                      color: "var(--color-text-secondary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-body)",
                    }}
                  >
                    Reveal seed
                  </button>
                ) : null}
              </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flexShrink: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <Button variant="secondary" size="md" onClick={copySeed}>
                  <Copy size={14} weight="Outline" />
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="secondary" size="md" onClick={() => setSeedRevealed((visible) => !visible)}>
                  {seedRevealed ? <EyeClosed size={14} weight="Outline" /> : <Eye size={14} weight="Outline" />}
                  {seedRevealed ? "Hide" : "Reveal"}
                </Button>
              </div>

              <Button onClick={() => setStep(3)}>
                <CheckCircle size={16} weight="Bold" />
                I have written it down
              </Button>
            </div>
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div {...stepMotion} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flex: 1, minHeight: 0, overflowY: "auto", paddingRight: "var(--space-1)" }}>
              <FlowHeader
                align="center"
                title="Confirm the backup"
              />

              <div style={cardStyle}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-mono-lg)",
                  lineHeight: 1.9,
                  letterSpacing: "0.06em",
                  wordBreak: "break-all",
                  color: "var(--color-text-primary)",
                }}
              >
                {seed.split("").map((char, index) => {
                  const blankIndex = checkPositions.indexOf(index);
                  if (blankIndex !== -1) {
                    const filled = checkInputs[blankIndex];
                    const correct = filled === char;
                    return (
                      <span
                        key={index}
                        style={{
                          display: "inline-block",
                          minWidth: "0.8em",
                          textAlign: "center",
                          borderRadius: 4,
                          background: filled
                            ? correct
                              ? "color-mix(in srgb, var(--color-accent) 16%, transparent)"
                              : "color-mix(in srgb, var(--color-status-error) 18%, transparent)"
                            : "var(--color-bg-elevated)",
                          color: filled
                            ? correct
                              ? "var(--color-accent)"
                              : "var(--color-status-error)"
                            : "var(--color-text-tertiary)",
                        }}
                      >
                        {filled || "_"}
                      </span>
                    );
                  }
                  return <span key={index}>{char}</span>;
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--space-3)" }}>
              {checkPositions.map((position, index) => {
                const value = checkInputs[index];
                const correct = value ? value === seed[position] : null;
                return (
                  <div key={position} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--text-caption)",
                        color: "var(--color-text-tertiary)",
                        textAlign: "center",
                      }}
                    >
                      #{position + 1}
                    </span>
                    <input
                      ref={(element) => {
                        checkRefs.current[index] = element;
                      }}
                      autoComplete="off"
                      value={value}
                      onChange={(event) => handleCheckInput(index, event.target.value)}
                      onKeyDown={(event) => handleCheckKey(index, event)}
                      maxLength={1}
                      autoFocus={index === 0}
                      style={{
                        width: "100%",
                        minHeight: "var(--height-button-md)",
                        textAlign: "center",
                        background: "var(--color-bg-surface-2)",
                        border: `1px solid ${
                          value
                            ? correct
                              ? "var(--color-accent)"
                              : "var(--color-status-error)"
                            : "var(--color-border-default)"
                        }`,
                        borderRadius: "var(--radius-control)",
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-mono-lg)",
                      }}
                    />
                  </div>
                );
              })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "var(--space-3)" }}>
                {checkPositions.map((position, index) => {
                  const value = checkInputs[index];
                  const correct = value ? value === seed[position] : null;
                  return (
                    <div key={position} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--text-caption)",
                          color: "var(--color-text-tertiary)",
                          textAlign: "center",
                        }}
                      >
                        #{position + 1}
                      </span>
                      <input
                        ref={(element) => {
                          checkRefs.current[index] = element;
                        }}
                        autoComplete="off"
                        value={value}
                        onChange={(event) => handleCheckInput(index, event.target.value)}
                        onKeyDown={(event) => handleCheckKey(index, event)}
                        maxLength={1}
                        autoFocus={index === 0}
                        style={{
                          width: "100%",
                          minHeight: "var(--height-button-md)",
                          textAlign: "center",
                          background: "var(--color-bg-surface-2)",
                          border: `1px solid ${
                            value
                              ? correct
                                ? "var(--color-accent)"
                                : "var(--color-status-error)"
                              : "var(--color-border-default)"
                          }`,
                          borderRadius: "var(--radius-control)",
                          color: "var(--color-text-primary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-mono-lg)",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ flexShrink: 0 }}>
              <Button onClick={() => setStep(4)} disabled={!checkComplete}>
                Confirm backup
                <CheckCircle size={16} weight="Bold" />
              </Button>
            </div>
          </motion.div>
        ) : null}

        {step === 4 ? (
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
                <LockKeyhole size={16} weight="Bold" />
                Create wallet
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </FullPage>
  );
}
