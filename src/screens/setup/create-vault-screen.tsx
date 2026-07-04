import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { deriveIdentityFromSeed, generateRandomSeed, newId } from "@/lib/crypto";
import { copyToClipboard } from "@/lib/clipboard";
import { SEED_AUTO_HIDE_MS, SEED_CLIPBOARD_CLEAR_SECS } from "@/lib/constants";
import {
  AltArrowLeft,
  AltArrowRight,
  Copy,
  Eye,
  EyeClosed,
  CheckCircle,
  LockKeyhole,
} from "@solar-icons/react";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault } from "@/lib/vault";
import { usePersistedStore, type VaultColor } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import type { Seed } from "@/lib/crypto";

type Step = 1 | 2 | 3 | 4;

function pickCheckPositions(seed: string, count = 4): number[] {
  const positions = new Set<number>();
  while (positions.size < count) {
    positions.add(Math.floor(Math.random() * seed.length));
  }
  return Array.from(positions).sort((a, b) => a - b);
}

function strengthOf(pw: string) {
  if (pw.length < 10) return { label: "Too short", level: 0, color: "var(--color-status-error)" };
  const score =
    (pw.length >= 14 ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  if (score <= 1) return { label: "Fair", level: 1, color: "var(--color-status-warning)" };
  if (score <= 2) return { label: "Good", level: 2, color: "var(--color-status-success)" };
  return { label: "Strong", level: 3, color: "var(--color-status-success)" };
}

const accentPill: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: "var(--space-2)",
  width: "100%", height: 48,
  background: "var(--color-accent)", color: "var(--color-bg-base)",
  borderRadius: "var(--radius-pill)", border: "none",
  fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "var(--text-body)",
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: "var(--space-2)",
  background: "none", border: "none", cursor: "pointer",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
  color: "var(--color-text-disabled)", padding: "var(--space-2) 0", alignSelf: "center",
};

const inputField: React.CSSProperties = {
  background: "transparent", border: "none",
  borderBottom: "1px solid var(--color-border-strong)",
  borderRadius: 0, padding: "var(--space-3) 0",
  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
  color: "var(--color-text-display)", width: "100%", outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
  fontWeight: 500, color: "var(--color-text-disabled)",
};


export default function CreateVaultScreen() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((s) => s.addVault);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const unlock = useSessionStore((s) => s.unlock);

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [seed] = useState<Seed>(() => generateRandomSeed());
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [checkPositions] = useState<number[]>(() => pickCheckPositions(seed));
  const [checkInputs, setCheckInputs] = useState(["", "", "", ""]);
  const checkRefs = useRef<(HTMLInputElement | null)[]>([]);

  const checkComplete = checkPositions.every((pos, i) => checkInputs[i] === seed[pos]);

  const [seedRevealed, setSeedRevealed] = useState(true);
  useEffect(() => {
    if (step !== 2) return;
    setSeedRevealed(true);
    const t = setTimeout(() => setSeedRevealed(false), SEED_AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [step]);

  const strength = strengthOf(password);

  function goStep2() {
    if (!name.trim()) { setNameError("Please enter a vault name"); return; }
    setNameError("");
    setStep(2);
  }

  async function copySeed() {
    await copyToClipboard(seed, SEED_CLIPBOARD_CLEAR_SECS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCheckInput(idx: number, raw: string) {
    const val = raw.slice(-1).toLowerCase();
    setCheckInputs((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    if (val) checkRefs.current[idx + 1]?.focus();
  }

  function handleCheckKey(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !checkInputs[idx]) {
      checkRefs.current[idx - 1]?.focus();
    }
  }

  async function finish() {
    if (password.length < 10 || strength.level < 1) return;
    setLoading(true);
    try {
      const encryptedData = await createVault(password, [seed]);
      const vault = {
        id: newId(),
        name: name.trim(),
        color: "slate" as VaultColor,
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
      addVault(vault);
      setActiveVault(vault.id);
      unlock(vault.id, unlockSecureSession([seed]));
      navigate("/dashboard", { replace: true });
    } catch {
      setLoading(false);
    }
  }

  return (
    <FullPage centered={false} style={{ justifyContent: "flex-start", paddingTop: "var(--space-8)" }}>
      <div style={{ width: "100%", maxWidth: 320, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Step progress bar */}
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              style={{
                flex: 1, height: 2, borderRadius: 1,
                background: step >= s ? "var(--color-accent)" : "var(--color-border-strong)",
                transition: "background 0.2s ease",
              }}
            />
          ))}
        </div>

        {/* Step 1 — Name */}
        {step === 1 && (
          <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Create your vault
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                Name it something you'll recognise.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <label style={labelStyle}>Vault name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                onKeyDown={(e) => e.key === "Enter" && goStep2()}
                placeholder="e.g. Main, Trading, Cold"
                autoFocus
                style={inputField}
              />
              {nameError && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>{nameError}</span>
              )}
            </div>

            <motion.button type="button" onClick={goStep2} {...gesture.press} style={accentPill}>
              Continue <AltArrowRight size={16} weight="Bold" />
            </motion.button>
            <motion.button type="button" onClick={() => navigate("/setup")} {...gesture.pressSubtle} style={ghostBtn}>
              <AltArrowLeft size={16} weight="Bold" /> Back
            </motion.button>
          </motion.div>
        )}

        {/* Step 2 — Seed display */}
        {step === 2 && (
          <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Your seed phrase
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-warning)" }}>
                Write this down. It cannot be recovered.
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <div
                style={{
                  background: "var(--color-bg-surface)",
                  borderRadius: "var(--radius-card)",
                  padding: "var(--space-4)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-mono-lg)",
                  color: "var(--color-text-display)",
                  letterSpacing: "0.06em",
                  lineHeight: 1.8,
                  wordBreak: "break-all",
                  filter: seedRevealed ? "none" : "blur(6px)",
                  userSelect: seedRevealed ? "text" : "none",
                  transition: "filter 0.2s ease-out",
                }}
                aria-hidden={!seedRevealed}
              >
                {seedRevealed
                  ? seed.split("").map((char, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02, duration: 0.04, ease: "easeOut" }}
                      >
                        {char}{(i + 1) % 5 === 0 && i < seed.length - 1 ? " " : ""}
                      </motion.span>
                    ))
                  : (
                      <span style={{ color: "var(--color-text-disabled)" }}>
                        {"•".repeat(Math.max(seed.length + Math.floor(seed.length / 5), 12))}
                      </span>
                    )}
              </div>
              {!seedRevealed && (
                <motion.button
                  type="button"
                  onClick={() => setSeedRevealed(true)}
                  {...gesture.pressSubtle}
                  style={{
                    position: "absolute", inset: 0, width: "100%", background: "none",
                    border: "none", cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "center", borderRadius: "var(--radius-card)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                    Tap to reveal
                  </span>
                </motion.button>
              )}
            </div>

            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <motion.button
                type="button"
                onClick={copySeed}
                {...gesture.pressSubtle}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                  background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
                  border: "none", borderRadius: "var(--radius-sharp)", padding: "var(--space-3) 0",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, cursor: "pointer",
                }}
              >
                <Copy size={14} weight="Linear" />
                {copied ? "Copied" : "Copy"}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setSeedRevealed((v) => !v)}
                {...gesture.pressSubtle}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
                  background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
                  border: "none", borderRadius: "var(--radius-sharp)", padding: "var(--space-3) 0",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, cursor: "pointer",
                }}
              >
                {seedRevealed ? <EyeClosed size={14} weight="Linear" /> : <Eye size={14} weight="Linear" />}
                {seedRevealed ? "Hide" : "Reveal"}
              </motion.button>
            </div>
            <motion.button type="button" onClick={() => setStep(3)} {...gesture.press} style={accentPill}>
              <CheckCircle size={16} weight="Bold" /> I've written it down
            </motion.button>
          </motion.div>
        )}

        {/* Step 3 — Spot-check backup */}
        {step === 3 && (
          <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Confirm your backup
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                Fill in the highlighted characters.
              </div>
            </div>

            <div
              style={{
                background: "var(--color-bg-surface)",
                borderRadius: "var(--radius-card)",
                padding: "var(--space-4)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-mono-lg)",
                letterSpacing: "0.06em",
                lineHeight: 1.8,
                wordBreak: "break-all",
              }}
            >
              {seed.split("").map((char, i) => {
                const blankIdx = checkPositions.indexOf(i);
                if (blankIdx !== -1) {
                  const filled = checkInputs[blankIdx];
                  const correct = filled === char;
                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        minWidth: "0.75em",
                        textAlign: "center",
                        background: filled ? (correct ? "rgba(204,252,251,0.15)" : "rgba(255,59,48,0.15)") : "var(--color-bg-elevated)",
                        color: filled ? (correct ? "var(--color-accent)" : "var(--color-status-error)") : "var(--color-text-disabled)",
                        borderRadius: 2,
                        transition: "background 0.1s ease, color 0.1s ease",
                      }}
                    >
                      {filled || "_"}
                    </span>
                  );
                }
                return <span key={i} style={{ color: "var(--color-text-display)" }}>{char}</span>;
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
              {checkPositions.map((pos, i) => (
                <div key={pos} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-2)", flex: 1 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
                    #{pos + 1}
                  </span>
                  <input
                    ref={(el) => { checkRefs.current[i] = el; }}
                    autoComplete="off"
                    value={checkInputs[i]}
                    onChange={(e) => handleCheckInput(i, e.target.value)}
                    onKeyDown={(e) => handleCheckKey(i, e)}
                    maxLength={1}
                    autoFocus={i === 0}
                    style={{
                      width: "100%", textAlign: "center",
                      fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-lg)",
                      background: "transparent",
                      border: "none",
                      borderBottom: `2px solid ${
                        checkInputs[i]
                          ? (checkInputs[i] === seed[pos] ? "var(--color-accent)" : "var(--color-status-error)")
                          : "var(--color-border-strong)"
                      }`,
                      borderRadius: 0,
                      padding: "var(--space-3) 0",
                      color: "var(--color-text-display)",
                      outline: "none",
                      transition: "border-color 0.1s ease",
                    }}
                  />
                </div>
              ))}
            </div>

            <motion.button type="button" onClick={() => setStep(4)} disabled={!checkComplete} {...gesture.press} style={{ ...accentPill, opacity: checkComplete ? 1 : 0.4 }}>
              Confirm <CheckCircle size={16} weight="Bold" />
            </motion.button>
          </motion.div>
        )}

        {/* Step 4 — Password */}
        {step === 4 && (
          <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Set a password
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                Minimum 10 characters. Never stored.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && strength.level >= 1 && finish()}
                  placeholder="••••••••••"
                  autoComplete="new-password"
                  spellCheck={false}
                  autoCapitalize="none"
                  aria-label="Password"
                  autoFocus
                  style={inputField}
                />
              </div>
              {password.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", gap: "var(--space-1)", flex: 1 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 2, borderRadius: 1,
                          background: i <= strength.level ? strength.color : "var(--color-border-strong)",
                          transition: "background 0.15s ease",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <motion.button type="button" onClick={finish} disabled={loading || strength.level < 1} {...gesture.press} style={{ ...accentPill, opacity: loading || strength.level < 1 ? 0.4 : 1 }}>
              {loading ? (
                <span style={{ width: 16, height: 16, border: "2px solid var(--color-bg-base)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              ) : (
                <>
                  <LockKeyhole size={16} weight="Bold" /> Create vault
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </div>
    </FullPage>
  );
}
