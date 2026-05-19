import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { FullPage } from "@/layouts/full-page";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { generateRandomSeed } from "@/lib/crypto";
import { createVault, createWallet } from "@/lib/vault";
import { usePersistedStore, type VaultColor } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import type { Seed } from "@/lib/crypto";

type Step = 1 | 2 | 3 | 4;

interface CharTile {
  id: number;
  char: string;
  used: boolean;
}

function shuffledTiles(seed: string): CharTile[] {
  const arr: CharTile[] = seed.split("").map((char, id) => ({ id, char, used: false }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const COLORS: VaultColor[] = ["slate", "red", "amber", "emerald", "sky", "violet"];

const COLOR_CSS: Record<VaultColor, string> = {
  slate: "var(--color-vault-slate)",
  red: "var(--color-vault-red)",
  amber: "var(--color-vault-amber)",
  emerald: "var(--color-vault-emerald)",
  sky: "var(--color-vault-sky)",
  violet: "var(--color-vault-violet)",
};

function strengthOf(pw: string) {
  if (pw.length < 10) return { label: "TOO SHORT", level: 0, color: "var(--color-status-error)" };
  const score =
    (pw.length >= 14 ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pw) ? 1 : 0);
  if (score <= 1) return { label: "FAIR", level: 1, color: "var(--color-status-warning)" };
  if (score <= 2) return { label: "GOOD", level: 2, color: "var(--color-status-success)" };
  return { label: "STRONG", level: 3, color: "var(--color-status-success)" };
}

export default function CreateVaultScreen() {
  const navigate = useNavigate();
  const addVault = usePersistedStore((s) => s.addVault);
  const unlock = useSessionStore((s) => s.unlock);

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [color, setColor] = useState<VaultColor>("slate");
  const [seed] = useState<Seed>(() => generateRandomSeed());
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step 3: character grid state
  const [tiles, setTiles] = useState<CharTile[]>(() => shuffledTiles(seed));
  const [confirmed, setConfirmed] = useState("");
  const [gridError, setGridError] = useState(false);

  const strength = strengthOf(password);

  function goStep2() {
    if (!name.trim()) { setNameError("NAME REQUIRED"); return; }
    setNameError("");
    setStep(2);
  }

  async function copySeed() {
    try {
      await invoke("copy_to_clipboard", { text: seed, clearAfterSecs: 0 });
    } catch {
      await navigator.clipboard.writeText(seed).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleTile(tileId: number, char: string) {
    const next = confirmed.length;
    if (next >= seed.length) return;
    if (char === seed[next]) {
      const newConfirmed = confirmed + char;
      setConfirmed(newConfirmed);
      setTiles((ts) => ts.map((t) => (t.id === tileId ? { ...t, used: true } : t)));
      if (newConfirmed.length === seed.length) setStep(4);
    } else {
      setGridError(true);
      setTimeout(() => setGridError(false), 500);
    }
  }

  function resetGrid() {
    setConfirmed("");
    setTiles((ts) => ts.map((t) => ({ ...t, used: false })));
    setGridError(false);
  }

  async function finish() {
    if (password.length < 10) return;
    setLoading(true);
    try {
      const encryptedData = await createVault(password, [seed]);
      const vault = {
        id: globalThis.crypto.randomUUID(),
        name: name.trim(),
        color,
        createdAt: Date.now(),
        lastUnlockedAt: Date.now(),
        accounts: [{ index: 0, name: "Account 1", addedAt: Date.now(), hidden: false }],
        encryptedData,
      };
      addVault(vault);
      unlock(vault.id, [seed], [createWallet(seed)]);
      navigate("/dashboard", { replace: true });
    } catch {
      setLoading(false);
    }
  }

  return (
    <FullPage centered={false} style={{ justifyContent: "flex-start", paddingTop: "var(--space-8)" }}>
      <div style={{ width: "100%", maxWidth: 320, margin: "0 auto" }}>
        {/* Step progress bar */}
        <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-8)" }}>
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 2,
                background: step >= s ? "var(--color-text-display)" : "var(--color-border-strong)",
                transition: `background var(--duration-base) var(--ease-out)`,
              }}
            />
          ))}
        </div>

        {/* Step 1 — Name + color */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Create your vault.
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                Name it something you'll recognise.
              </div>
            </div>

            <Input
              label="Vault name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goStep2()}
              error={nameError}
              placeholder="e.g. Main, Trading, Cold"
              autoFocus
              style={{ fontFamily: "var(--font-sans)" }}
            />

            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "var(--space-3)" }}>
                Color
              </div>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={`Vault color: ${c}`}
                    aria-pressed={color === c}
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: COLOR_CSS[c],
                      border: color === c ? "2px solid var(--color-text-display)" : "2px solid transparent",
                      cursor: "pointer", outline: "none", padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            <Button onClick={goStep2}>Continue</Button>
            <Button variant="ghost" size="md" shape="sharp" style={{ width: "auto", margin: "0 auto" }} onClick={() => navigate("/setup")}>
              Back
            </Button>
          </div>
        )}

        {/* Step 2 — Seed display */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Your seed phrase.
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-status-warning)" }}>
                Write this down. It cannot be recovered.
              </div>
            </div>

            <div
              aria-label="Your seed phrase"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                padding: "var(--space-4)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-mono-lg)",
                color: "var(--color-text-display)",
                letterSpacing: "0.08em",
                lineHeight: 1.8,
                wordBreak: "break-all",
              }}
            >
              {(seed.match(/.{1,5}/g) ?? []).map((group, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.08, ease: "easeOut" }}
                >
                  {group}{" "}
                </motion.span>
              ))}
            </div>

            <Button variant="secondary" shape="sharp" size="md" style={{ width: "auto" }} onClick={copySeed}>
              {copied ? "[COPIED]" : "Copy to clipboard"}
            </Button>
            <Button onClick={() => setStep(3)}>I've written it down</Button>
          </div>
        )}

        {/* Step 3 — Backup confirmation grid */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Confirm your backup.
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                Tap each character in order.
              </div>
            </div>

            {/* Progress display */}
            <div
              aria-label={`Confirmed ${confirmed.length} of ${seed.length} characters`}
              aria-live="polite"
              style={{
                background: "var(--color-bg-surface)",
                border: "1px solid",
                borderColor: gridError ? "var(--color-status-error)" : "var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                padding: "var(--space-3)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-mono-sm)",
                letterSpacing: "0.1em",
                lineHeight: 1.9,
                minHeight: 72,
                wordBreak: "break-all",
                transition: "border-color 0.12s ease-out",
              }}
            >
              <span style={{ color: "var(--color-text-display)" }}>{confirmed}</span>
              <span style={{ color: "var(--color-text-disabled)" }}>{"_".repeat(seed.length - confirmed.length)}</span>
            </div>

            {/* Character tile grid */}
            <div
              role="group"
              aria-label="Seed character tiles"
              style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}
            >
              {tiles.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => handleTile(tile.id, tile.char)}
                  disabled={tile.used}
                  aria-label={tile.used ? undefined : `Character ${tile.char}`}
                  aria-hidden={tile.used}
                  style={{
                    height: 32,
                    background: tile.used ? "transparent" : "var(--color-bg-elevated)",
                    border: "1px solid",
                    borderColor: tile.used ? "transparent" : "var(--color-border-strong)",
                    borderRadius: "var(--radius-sharp)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-mono-sm)",
                    color: tile.used ? "transparent" : "var(--color-text-display)",
                    cursor: tile.used ? "default" : "pointer",
                    transition: "background 0.08s ease-out, color 0.08s ease-out, border-color 0.08s ease-out",
                    padding: 0,
                  }}
                >
                  {tile.used ? "" : tile.char}
                </button>
              ))}
            </div>

            {confirmed.length > 0 && (
              <button
                onClick={resetGrid}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
                  color: "var(--color-text-disabled)", letterSpacing: "0.05em",
                  textAlign: "right", padding: 0, alignSelf: "flex-end",
                }}
              >
                CLEAR
              </button>
            )}
          </div>
        )}

        {/* Step 4 — Password */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: "var(--space-2)" }}>
                Set a password.
              </div>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                Minimum 10 characters. Never stored.
              </div>
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && password.length >= 10 && finish()}
                placeholder="••••••••••"
                autoFocus
                containerStyle={{ marginBottom: "var(--space-3)" }}
              />
              {password.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", gap: 3, flex: 1 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 2,
                          background: i <= strength.level ? strength.color : "var(--color-border-strong)",
                          transition: `background var(--duration-fast) var(--ease-out)`,
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: strength.color, letterSpacing: "0.05em" }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <Button onClick={finish} loading={loading} disabled={password.length < 10}>
              Create vault
            </Button>
          </div>
        )}
      </div>
    </FullPage>
  );
}
