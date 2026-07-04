import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { invoke } from "@tauri-apps/api/core";
import { LockKeyhole } from "@solar-icons/react";
import { motion } from "motion/react";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault, toSeed } from "@/lib/vault";
import { extractMessage } from "@/lib/format";
import { FullPage } from "@/layouts/full-page";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { Identicon } from "@/components/identicon";
import type { Seed } from "@/lib/crypto";
import { isWatchOnlyVault } from "@/lib/accounts";
import { recordAuditEvent } from "@/lib/audit-log";

interface FormValues {
  password: string;
}

const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_SECS = 30;

const VAULT_COLOR: Record<string, string> = {
  slate: "var(--color-vault-slate)",
  red: "var(--color-vault-red)",
  amber: "var(--color-vault-amber)",
  emerald: "var(--color-vault-emerald)",
  sky: "var(--color-vault-sky)",
  violet: "var(--color-vault-violet)",
};

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

  const lockedVaults = vaults.filter((v) => !isWatchOnlyVault(v));
  const hasMultiple = lockedVaults.length > 1;

  const [selectedId, setSelectedId] = useState<string>(() => {
    const activeId = settings.activeVaultId;
    if (activeId && lockedVaults.some((v) => v.id === activeId)) return activeId;
    return lockedVaults[0]?.id ?? "";
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  const selected = lockedVaults.find((v) => v.id === selectedId) ?? lockedVaults[0];
  const watchOnly = selected ? isWatchOnlyVault(selected) : false;
  const bioEnabled = selected ? (settings.biometricVaultIds ?? []).includes(selected.id) : false;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioFailures, setBioFailures] = useState(_bioFailures);
  const [, setPasswordAttempts] = useState(_passwordAttempts);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { register, handleSubmit, setValue } = useForm<FormValues>();

  useEffect(() => () => { if (lockoutRef.current) clearInterval(lockoutRef.current); }, []);

  // Reset password when vault changes
  useEffect(() => {
    setValue("password", "");
    setError("");
  }, [selectedId, setValue]);

  // Resume lockout on mount
  useEffect(() => {
    const remaining = Math.ceil((passwordLockoutUntil - Date.now()) / 1000);
    if (remaining > 0) startCountdown(remaining);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } finally {
      setLoading(false);
    }
  }

  async function onBiometric() {
    if (!selected || bioFailures >= 3) return;
    setLoading(true);
    setError("");
    if (!selected.encryptedData) { setError("Vault data missing"); setLoading(false); return; }
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

  function selectVault(id: string) {
    setSelectedId(id);
    setSheetOpen(false);
  }

  const lastUnlocked = selected?.lastUnlockedAt
    ? new Date(selected.lastUnlockedAt).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  if (!selected) return null;

  return (
    <FullPage>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center" }}>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-display)",
            fontWeight: 400,
            color: "var(--color-text-display)",
            letterSpacing: "0.15em",
          }}>
            GLYPH
          </span>
        </div>

        {/* Vault selector */}
        {hasMultiple ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-3)",
              background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-card)", padding: "var(--space-3) var(--space-4)",
              cursor: "pointer", width: "100%",
            }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
              background: VAULT_COLOR[selected.color] ?? "var(--color-text-secondary)",
            }} />
            <span style={{
              flex: 1, textAlign: "left",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
              fontWeight: 500, color: "var(--color-text-display)",
            }}>
              {selected.name}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-text-disabled)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        ) : (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)" }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: VAULT_COLOR[selected.color] ?? "var(--color-text-secondary)",
            }} />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
              fontWeight: 500, color: "var(--color-text-primary)",
              letterSpacing: "0.02em",
            }}>
              {selected.name}
            </span>
          </div>
        )}

        {/* Password / Watch-only */}
        {watchOnly ? (
          <Button onClick={() => onSubmit({ password: "" })}>
            Open vault
          </Button>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Input
              {...register("password")}
              type="password"
              label="Password"
              placeholder="••••••••••"
              autoComplete="current-password"
              error={lockoutSecsLeft > 0 ? `Locked — try again in ${lockoutSecsLeft}s` : error}
              disabled={lockoutSecsLeft > 0}
              autoFocus
            />
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
            <LockKeyhole size={16} color="var(--color-text-disabled)" weight="Linear" />
            <span style={{
              fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
              color: "var(--color-text-disabled)", letterSpacing: "0.04em",
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

        {/* Last unlocked */}
        {lastUnlocked && (
          <span style={{
            textAlign: "center",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
            color: "var(--color-text-disabled)", opacity: 0.6,
          }}>
            Last unlocked {lastUnlocked}
          </span>
        )}
      </motion.div>

      {/* Vault picker sheet */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Select vault">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          {lockedVaults.map((v) => {
            const isActive = v.id === selectedId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => selectVault(v.id)}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  display: "flex", alignItems: "center", gap: "var(--space-3)",
                  background: isActive ? "var(--color-bg-surface)" : "transparent",
                  border: "none", borderRadius: "var(--radius-sharp)",
                  padding: "10px var(--space-3)", cursor: "pointer", width: "100%",
                  textAlign: "left",
                }}
              >
                <Identicon seed={`${v.id}:${v.color}`} size={32} radius={6} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                    fontWeight: isActive ? 600 : 400, color: "var(--color-text-display)",
                  }}>
                    {v.name}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                    color: "var(--color-text-disabled)",
                  }}>
                    Unlocked {timeAgo(v.lastUnlockedAt)}
                  </span>
                </div>
                {v.accounts.length > 0 && (
                  <span style={{
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
                    color: "var(--color-text-disabled)",
                  }}>
                    {v.accounts.length} {v.accounts.length === 1 ? "account" : "accounts"}
                  </span>
                )}
                {isActive && (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: "var(--color-accent)",
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </Sheet>
    </FullPage>
  );
}
