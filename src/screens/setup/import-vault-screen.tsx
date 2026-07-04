import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { deriveIdentityFromSeed, toSeed, InvalidSeedError, newId } from "@/lib/crypto";
import { unlockSecureSession } from "@/lib/secure-session";
import { createVault } from "@/lib/vault";
import { usePersistedStore, type VaultColor } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { truncateId } from "@/lib/format";
import type { Seed } from "@/lib/crypto";

type Step = 1 | 2 | 3;

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
  width: "100%", height: 48,
  background: "var(--color-accent)", color: "var(--color-bg-base)",
  borderRadius: "var(--radius-pill)", border: "none",
  fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "var(--text-body)",
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
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

  const [password, setPassword] = useState("");
  const [seedError, setSeedError] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = strengthOf(password);

  function validateAndContinue() {
    try {
      const s = toSeed(seedInput.trim().toLowerCase());
      setSeed(s);
      setDerivedIdentity(deriveIdentityFromSeed(s));
      setSeedError("");
      setStep(2);
    } catch (e) {
      setSeedError(e instanceof InvalidSeedError ? "Enter exactly 55 lowercase letters" : "Invalid seed phrase. Check your input and try again.");
    }
  }

  function goStep3() {
    if (!name.trim()) { setNameError("Please enter a vault name"); return; }
    setNameError("");
    setStep(3);
  }

  async function finish() {
    if (!seed || strength.level < 1) return;
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
          identity: derivedIdentity ?? undefined,
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
          {([1, 2, 3] as Step[]).map((s) => (
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

        {/* Step 1 — Enter seed */}
        {step === 1 && (
          <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Import your seed
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                55 lowercase letters. Never shared.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <label style={labelStyle}>Seed phrase</label>
              <input
                type="password"
                value={seedInput}
                onChange={(e) => { setSeedInput(e.target.value); if (seedError) setSeedError(""); }}
                onKeyDown={(e) => e.key === "Enter" && validateAndContinue()}
                placeholder="55 characters, lowercase"
                spellCheck={false}
                autoCapitalize="none"
                aria-label="Seed phrase"
                autoFocus
                style={inputField}
              />
              {seedError && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>{seedError}</span>
              )}
            </div>

            <motion.button type="button" onClick={validateAndContinue} {...gesture.press} style={accentPill}>
              Continue
            </motion.button>
            <motion.button type="button" onClick={() => navigate("/setup")} {...gesture.pressSubtle} style={ghostBtn}>
              Back
            </motion.button>
          </motion.div>
        )}

        {/* Step 2 — Name */}
        {step === 2 && (
          <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Name your vault
              </div>
              {derivedIdentity && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
                    Derived address
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", wordBreak: "break-all" }}>
                    {truncateId(derivedIdentity, 12, 12)}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <label style={labelStyle}>Vault name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setNameError(""); }}
                onKeyDown={(e) => e.key === "Enter" && goStep3()}
                placeholder="e.g. Main, Trading, Cold"
                autoFocus
                style={inputField}
              />
              {nameError && (
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>{nameError}</span>
              )}
            </div>

            <motion.button type="button" onClick={goStep3} {...gesture.press} style={accentPill}>
              Continue
            </motion.button>
          </motion.div>
        )}

        {/* Step 3 — Password */}
        {step === 3 && (
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
              ) : "Import vault"}
            </motion.button>
          </motion.div>
        )}
      </div>
    </FullPage>
  );
}
