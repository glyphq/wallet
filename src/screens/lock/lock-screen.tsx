import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { invoke } from "@tauri-apps/api/core";
import { LockKeyhole, Eye, EyeClosed } from "@solar-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { presets, gesture } from "@/lib/animations";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, toSeed } from "@/lib/vault";
import { extractMessage } from "@/lib/format";
import { FullPage } from "@/layouts/full-page";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Identicon } from "@/components/identicon";
import type { Seed } from "@/lib/crypto";
import { isWatchOnlyVault } from "@/lib/accounts";
import { recordAuditEvent } from "@/lib/audit-log";

interface FormValues {
  password: string;
}

const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_SECS = 30;

let _bioFailures = 0;
let _passwordAttempts = 0;

function timeAgo(ms: number): string {
  if (!ms) return "Never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Vault card ───────────────────────────────────────────────────────────────

function VaultCard({ vault, selected, onSelect }: {
  vault: NonNullable<ReturnType<typeof usePersistedStore.getState>["vaults"][number]>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        width: "100%", padding: "var(--space-3)",
        background: selected ? "var(--color-bg-surface)" : "transparent",
        border: selected ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subtle)",
        borderRadius: "var(--radius-sharp)",
        cursor: "pointer", textAlign: "left",
      }}
    >
      <Identicon seed={`${vault.id}:${vault.color}`} size={32} radius={6} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
          fontWeight: selected ? 600 : 400, color: "var(--color-text-display)",
        }}>
          {vault.name}
        </span>
        <span style={{
          fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
          color: "var(--color-text-disabled)",
        }}>
          {vault.accounts.length} {vault.accounts.length === 1 ? "account" : "accounts"} · {timeAgo(vault.lastUnlockedAt)}
        </span>
      </div>
      {selected && (
        <div style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: "var(--color-accent)",
        }} />
      )}
    </motion.button>
  );
}

// ── Lock screen ──────────────────────────────────────────────────────────────

export default function LockScreen() {
  const navigate = useNavigate();
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");

  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const touchVaultUnlocked = usePersistedStore((s) => s.touchVaultUnlocked);
  const unlock = useSessionStore((s) => s.unlock);
  const hasPendingRequest = useSessionStore((s) => s.pendingRequests.length > 0);
  const passwordLockoutUntil = usePersistedStore((s) => s.passwordLockoutUntil);
  const setPasswordLockoutUntil = usePersistedStore((s) => s.setPasswordLockoutUntil);

  const lockedVaults = vaults
    .filter((v) => !isWatchOnlyVault(v))
    .sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));
  const hasMultiple = lockedVaults.length > 1;

  const [selectedId, setSelectedId] = useState<string>(() => {
    // Default to the most recently unlocked vault
    return lockedVaults[0]?.id ?? "";
  });

  const selected = lockedVaults.find((v) => v.id === selectedId) ?? lockedVaults[0];
  const watchOnly = selected ? isWatchOnlyVault(selected) : false;
  const bioEnabled = selected ? (settings.biometricVaultIds ?? []).includes(selected.id) : false;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioFailures, setBioFailures] = useState(_bioFailures);
  const [, setPasswordAttempts] = useState(_passwordAttempts);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const { register, handleSubmit, setValue } = useForm<FormValues>();

  useEffect(() => () => { if (lockoutRef.current) clearInterval(lockoutRef.current); }, []);

  useEffect(() => {
    setValue("password", "");
    setError("");
  }, [selectedId, setValue]);

  useEffect(() => {
    const remaining = Math.ceil((passwordLockoutUntil - Date.now()) / 1000);
    if (remaining > 0) startCountdown(remaining);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setValue("password", "");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setValue]);

  function startCountdown(secs: number) {
    setLockoutSecsLeft(secs);
    lockoutRef.current = setInterval(() => {
      setLockoutSecsLeft((s) => {
        if (s <= 1) {
          if (lockoutRef.current) clearInterval(lockoutRef.current);
          lockoutRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function startLockout() {
    setPasswordLockoutUntil(Date.now() + PASSWORD_LOCKOUT_SECS * 1000);
    startCountdown(PASSWORD_LOCKOUT_SECS);
  }

  async function finishUnlock(seeds: Seed[]) {
    if (!selected) return;
    setActiveVault(selected.id);
    const wallets = unlockSecureSession(seeds);
    unlock(selected.id, wallets);
    touchVaultUnlocked(selected.id);
    recordAuditEvent({
      kind: "unlock_succeeded",
      status: "success",
      title: "Vault unlocked",
      detail: selected.name,
      vaultId: selected.id,
    });
    _bioFailures = 0;
    _passwordAttempts = 0;
    setUnlocking(true);
    await new Promise<void>((r) => setTimeout(r, 600));
    navigate(hasPendingRequest ? "/request" : "/dashboard", { replace: true });
  }

  async function doUnlock(password: string) {
    if (!selected || !selected.encryptedData) return;
    const seeds = await unlockVault(selected.encryptedData, password);
    await finishUnlock(seeds);
  }

  async function onSubmit({ password }: FormValues) {
    if (!selected || lockoutSecsLeft > 0) return;
    if (watchOnly) {
      unlock(selected.id, [], {
        watchOnly: true,
        identities: selected.accounts.map((a) => a.identity).filter((id): id is string => !!id),
      });
      setActiveVault(selected.id);
      touchVaultUnlocked(selected.id);
      navigate(hasPendingRequest ? "/request" : "/dashboard", { replace: true });
      return;
    }
    setLoading(true);
    setError("");
    try {
      await doUnlock(password);
    } catch {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Unlock failed",
        detail: selected.name,
        vaultId: selected.id,
      });
      const next = _passwordAttempts + 1;
      _passwordAttempts = next;
      setPasswordAttempts(next);
      if (next >= PASSWORD_MAX_ATTEMPTS) {
        setError(`Too many attempts — wait ${PASSWORD_LOCKOUT_SECS}s`);
        startLockout();
        _passwordAttempts = 0;
        setPasswordAttempts(0);
      } else {
        setError(`Wrong password — ${PASSWORD_MAX_ATTEMPTS - next} ${PASSWORD_MAX_ATTEMPTS - next === 1 ? "attempt" : "attempts"} remaining`);
      }
      setShakeKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function onBiometric() {
    if (!selected || bioFailures >= 3) return;
    setLoading(true);
    setError("");
    if (!selected.encryptedData) { setError("Vault data missing. Try re-importing your vault."); setLoading(false); return; }
    try {
      const seeds = await invoke<string[]>("biometric_unlock", {
        vaultId: selected.id,
        vaultData: selected.encryptedData,
      });
      await finishUnlock(seeds.map(toSeed));
    } catch (e) {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Biometric unlock failed",
        detail: selected.name,
        vaultId: selected.id,
      });
      const next = bioFailures + 1;
      _bioFailures = next;
      setBioFailures(next);
      if (next >= 3) {
        setError("Too many failures — use password");
      } else {
        setError(`${isLinux ? "Quick unlock" : "Biometric"} failed: ${extractMessage(e)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!selected) return null;

  return (
    <FullPage>
      <AnimatePresence mode="wait">
        {unlocking ? (
          <motion.div
            key="unlock-ok"
            {...presets.fadeIn}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "var(--space-4)",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "var(--color-accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <LockKeyhole size={22} weight="Bold" style={{ color: "var(--color-bg-base)" }} />
              </div>
            </motion.div>
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              color: "var(--color-text-disabled)",
            }}>
              Unlocking…
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="lock-form"
            {...presets.fadeIn}
            style={{
              width: "100%", maxWidth: 360,
              display: "flex", flexDirection: "column", gap: "var(--space-6)",
            }}
          >
            {/* Logo */}
            <div style={{ textAlign: "center", marginBottom: "var(--space-2)" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
                <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                  <rect x="4" y="4" width="32" height="32" rx="8" stroke="var(--color-text-display)" strokeWidth="2" />
                  <path d="M14 14h12M14 20h12M14 26h8" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-1)" }}>
                  <span style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-headline)",
                    fontWeight: 600,
                    color: "var(--color-text-display)",
                    letterSpacing: "-0.01em",
                  }}>
                    Glyph
                  </span>
                  <span style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-headline)",
                    fontWeight: 300,
                    color: "var(--color-text-secondary)",
                    letterSpacing: "-0.01em",
                  }}>
                    Wallet
                  </span>
                </div>
              </div>
            </div>

            {/* Vault list — always visible when multiple (scrollable for 4+) */}
            {hasMultiple && (
              <div style={{
                display: "flex", flexDirection: "column", gap: "var(--space-2)",
                maxHeight: 220, overflowY: "auto", overflowX: "hidden",
                scrollbarWidth: "thin",
              }}>
                {lockedVaults.map((v) => (
                  <VaultCard
                    key={v.id}
                    vault={v}
                    selected={v.id === selectedId}
                    onSelect={() => setSelectedId(v.id)}
                  />
                ))}
              </div>
            )}

            {/* Single vault — just name + identicon */}
            {!hasMultiple && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "var(--space-2)",
              }}>
                <Identicon seed={`${selected.id}:${selected.color}`} size={24} radius={6} />
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                  fontWeight: 500, color: "var(--color-text-primary)",
                }}>
                  {selected.name}
                </span>
              </div>
            )}

            {/* Create new vault */}
            <motion.button
              {...gesture.pressSubtle}
              onClick={() => navigate("/setup")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "var(--space-2)", width: "100%", padding: "var(--space-3)",
                background: "transparent",
                border: "1px dashed var(--color-border-strong)",
                borderRadius: "var(--radius-sharp)",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-disabled)" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                fontWeight: 500, color: "var(--color-text-disabled)",
              }}>
                Create new vault
              </span>
            </motion.button>

            {/* Password / Watch-only */}
            {watchOnly ? (
              <Button onClick={() => onSubmit({ password: "" })}>
                Open vault
              </Button>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div key={shakeKey} className={error ? "lock-shake" : undefined}>
                  <Input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    label="Password"
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    spellCheck={false}
                    autoCapitalize="none"
                    error={lockoutSecsLeft > 0 ? `Locked — try again in ${lockoutSecsLeft}s` : error}
                    disabled={lockoutSecsLeft > 0}
                    autoFocus
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", padding: 0,
                          color: "var(--color-text-disabled)",
                        }}
                      >
                        {showPassword ? <EyeClosed size={18} weight="Linear" /> : <Eye size={18} weight="Linear" />}
                      </button>
                    }
                  />
                </div>
                <Button type="submit" loading={loading} disabled={lockoutSecsLeft > 0}>
                  {lockoutSecsLeft > 0 ? `Wait ${lockoutSecsLeft}s` : "Unlock"}
                </Button>
              </form>
            )}

            {/* Biometric */}
            {!watchOnly && bioEnabled && bioFailures < 3 && (
              <button
                onClick={onBiometric}
                disabled={loading}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "var(--space-2)", width: "100%",
                  background: "none", border: "none",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.4 : 1, padding: "var(--space-2)",
                }}
              >
                <LockKeyhole size={14} color="var(--color-text-disabled)" weight="Linear" />
                <span style={{
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                  color: "var(--color-text-disabled)",
                }}>
                  {isLinux ? "Quick unlock" : "Biometric"}
                </span>
              </button>
            )}
            {!watchOnly && bioEnabled && bioFailures >= 3 && (
              <span style={{
                textAlign: "center", fontFamily: "var(--font-sans)",
                fontSize: "var(--text-caption)", color: "var(--color-text-disabled)",
              }}>
                {isLinux ? "Quick unlock" : "Biometric"} unavailable
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </FullPage>
  );
}
