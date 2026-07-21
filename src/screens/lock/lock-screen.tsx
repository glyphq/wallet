import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "motion/react";
import { AddCircle, Eye, EyeClosed, LockKeyhole } from "@solar-icons/react";
import { presets } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
import { Input } from "@/components/input";
import { Identicon } from "@/components/identicon";
import { isWatchOnlyVault } from "@/lib/accounts";
import { recordAuditEvent } from "@/lib/audit-log";
import { extractMessage, timeAgo } from "@/lib/format";
import { restoreSessionWalletsFromIdentities, unlockSecureSession } from "@/lib/secure-session";
import { unlockVault } from "@/lib/vault";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import type { Seed } from "@/lib/crypto";

interface FormValues {
  password: string;
}

const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_SECS = 30;
let biometricFailures = 0;

function BaseChip({ children, style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        maxWidth: "100%",
        padding: "var(--space-2) var(--space-4)",
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-body-sm)",
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function VaultChip({
  vault,
  selected,
  onSelect,
}: {
  vault: NonNullable<ReturnType<typeof usePersistedStore.getState>["vaults"][number]>;
  selected: boolean;
  onSelect: () => void;
}) {
  const lastOpened = vault.lastUnlockedAt ? `Last opened ${timeAgo(vault.lastUnlockedAt)}` : "Not opened yet";

  return (
    <BaseChip
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${vault.name}. ${lastOpened}`}
      title={lastOpened}
      style={{
        border: `1px solid ${selected ? "var(--color-text-primary)" : "var(--color-border-default)"}`,
        background: selected ? "var(--color-bg-subtle)" : "var(--color-bg-surface-2)",
        color: selected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      }}
    >
      <Identicon kind="vault" seed={`${vault.id}:${vault.color}`} label={vault.name} size={18} radius={6} padding={1} walletIcon={vault.icon} vaultColor={vault.color} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{vault.name}</span>
    </BaseChip>
  );
}

function NewVaultChip({ onClick }: { onClick: () => void }) {
  return (
    <BaseChip
      onClick={onClick}
      aria-label="Create or import a new wallet"
      title="Create or import a new wallet"
      style={{
        border: "1px dashed var(--color-border-strong)",
        background: "transparent",
        color: "var(--color-text-tertiary)",
      }}
    >
      <AddCircle size={16} weight="Linear" aria-hidden="true" />
      <span>New</span>
    </BaseChip>
  );
}

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
      aria-label={visible ? "Hide password" : "Show password"}
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
      {visible ? <EyeClosed size={18} weight="Linear" /> : <Eye size={18} weight="Linear" />}
    </button>
  );
}

export default function LockScreen() {
  const navigate = useNavigate();
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");

  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const touchVaultUnlocked = usePersistedStore((s) => s.touchVaultUnlocked);
  const passwordLockoutUntil = usePersistedStore((s) => s.passwordLockoutUntil);
  const setPasswordLockoutUntil = usePersistedStore((s) => s.setPasswordLockoutUntil);
  const passwordAttempts = usePersistedStore((s) => s.passwordAttempts);
  const setPasswordAttempts = usePersistedStore((s) => s.setPasswordAttempts);
  const unlock = useSessionStore((s) => s.unlock);
  const hasPendingRequest = useSessionStore((s) => s.pendingRequests.length > 0);

  const lockedVaults = vaults
    .filter((vault) => !isWatchOnlyVault(vault))
    .sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));
  useEffect(() => {
    if (vaults.length > 0 && lockedVaults.length === 0) {
      navigate("/setup", { replace: true });
    }
  }, [vaults.length, lockedVaults.length, navigate]);

  const [selectedId, setSelectedId] = useState<string>(() => lockedVaults[0]?.id ?? "");
  const selected = lockedVaults.find((vault) => vault.id === selectedId) ?? lockedVaults[0];
  const watchOnly = selected ? isWatchOnlyVault(selected) : false;
  const biometricEnabled = selected ? (settings.biometricVaultIds ?? []).includes(selected.id) : false;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioFailures, setBioFailures] = useState(biometricFailures);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const { register, handleSubmit, setValue } = useForm<FormValues>();

  useEffect(() => () => {
    if (lockoutRef.current) clearInterval(lockoutRef.current);
  }, []);

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
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setValue("password", "");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setValue]);

  function startCountdown(secs: number) {
    setLockoutSecsLeft(secs);
    lockoutRef.current = setInterval(() => {
      setLockoutSecsLeft((value) => {
        if (value <= 1) {
          if (lockoutRef.current) clearInterval(lockoutRef.current);
          lockoutRef.current = null;
          return 0;
        }
        return value - 1;
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
    const wallets = await unlockSecureSession(seeds);
    unlock(selected.id, wallets);
    touchVaultUnlocked(selected.id);
    recordAuditEvent({
      kind: "unlock_succeeded",
      status: "success",
      title: "Wallet unlocked",
      detail: selected.name,
      vaultId: selected.id,
    });
    biometricFailures = 0;
    setPasswordAttempts(0);
    setUnlocking(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
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
        identities: selected.accounts.map((account) => account.identity).filter((identity): identity is string => !!identity),
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
      const nextAttempts = passwordAttempts + 1;
      setPasswordAttempts(nextAttempts);
      if (nextAttempts >= PASSWORD_MAX_ATTEMPTS) {
        setError(`Too many attempts. Wait ${PASSWORD_LOCKOUT_SECS} seconds before trying again.`);
        startLockout();
        setPasswordAttempts(0);
      } else {
        const remaining = PASSWORD_MAX_ATTEMPTS - nextAttempts;
        setError(`Wrong password. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`);
      }
      setShakeKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  async function onBiometric() {
    if (!selected || bioFailures >= 3) return;
    setLoading(true);
    setError("");
    if (!selected.encryptedData) {
      setError("Wallet data is missing. Re-import the wallet and try again.");
      setLoading(false);
      return;
    }
    try {
      const seedCount = await invoke<number>("biometric_unlock", {
        vaultId: selected.id,
        vaultData: selected.encryptedData,
      });
      const identities = selected.accounts
        .slice(0, seedCount)
        .map((account) => account.identity)
        .filter((identity): identity is string => !!identity);
      unlock(selected.id, restoreSessionWalletsFromIdentities(identities));
      setActiveVault(selected.id);
      touchVaultUnlocked(selected.id);
      recordAuditEvent({
        kind: "unlock_succeeded",
        status: "success",
        title: "Wallet unlocked",
        detail: selected.name,
        vaultId: selected.id,
      });
      biometricFailures = 0;
      setPasswordAttempts(0);
      setUnlocking(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 600));
      navigate(hasPendingRequest ? "/request" : "/dashboard", { replace: true });
    } catch (event) {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Biometric unlock failed",
        detail: selected.name,
        vaultId: selected.id,
      });
      const nextFailures = bioFailures + 1;
      biometricFailures = nextFailures;
      setBioFailures(nextFailures);
      if (nextFailures >= 3) {
        setError("Too many biometric failures. Use the password instead.");
      } else {
        setError(`${isLinux ? "Quick unlock" : "Biometric unlock"} failed: ${extractMessage(event)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!selected) return null;

  return (
    <FullPage centered={false} style={{ justifyContent: "flex-start", paddingTop: "var(--space-8)", paddingBottom: "var(--space-8)" }}>
      <AnimatePresence mode="wait">
        {unlocking ? (
          <motion.div
            key="unlocking"
            {...presets.fadeIn}
            style={{
              width: "100%",
              maxWidth: 320,
              margin: "0 auto",
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-4)",
              textAlign: "center",
            }}
          >
            <BrandLockup align="center" compact subtitle="Opening your local wallet" />
            <div
              aria-hidden="true"
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: "2px solid var(--color-border-default)",
                borderTopColor: "var(--color-accent)",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                color: "var(--color-text-secondary)",
              }}
            >
              Unlocking local session.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            {...presets.fadeIn}
            style={{
              width: "100%",
              maxWidth: 340,
              margin: "0 auto",
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-8)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", flexShrink: 0, overflowY: "auto", paddingRight: "var(--space-1)" }}>
              <BrandLockup align="center" compact />
              <FlowHeader align="center" title="Unlock" description={selected?.name} />

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {lockedVaults.map((vault) => (
                  <VaultChip
                    key={vault.id}
                    vault={vault}
                    selected={vault.id === selectedId}
                    onSelect={() => {
                      setSelectedId(vault.id);
                    }}
                  />
                ))}
                <NewVaultChip onClick={() => navigate("/setup")} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flex: 1, justifyContent: "center", maxWidth: 340, width: "100%", margin: "0 auto" }}>
              {watchOnly ? (
                <Button onClick={() => onSubmit({ password: "" })}>
                  <LockKeyhole size={16} weight="Linear" aria-hidden="true" />
                  Open wallet
                </Button>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <div key={shakeKey} className={error ? "lock-shake" : undefined}>
                    <Input
                      {...register("password")}
                      type={showPassword ? "text" : "password"}
                      label="Password"
                      labelStyle={{ fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}
                      containerStyle={{ gap: "var(--space-3)" }}
                      style={{ minHeight: 56, fontSize: "var(--text-section)", padding: "var(--space-4) 44px var(--space-4) var(--space-4)" }}
                      placeholder="Enter the wallet password"
                      autoComplete="current-password"
                      error={lockoutSecsLeft > 0 ? `Locked. Try again in ${lockoutSecsLeft} seconds.` : error}
                      disabled={lockoutSecsLeft > 0}
                      autoFocus
                      rightElement={<PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} />}
                    />
                  </div>
                  <Button type="submit" loading={loading} disabled={lockoutSecsLeft > 0}>
                    <LockKeyhole size={16} weight="Linear" aria-hidden="true" />
                    {lockoutSecsLeft > 0 ? `Wait ${lockoutSecsLeft} seconds` : "Unlock wallet"}
                  </Button>
                </form>
              )}

              {!watchOnly && biometricEnabled && bioFailures < 3 ? (
                <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={onBiometric} disabled={loading}>
                  <LockKeyhole size={14} weight="Linear" />
                  {isLinux ? "Quick unlock" : "Use biometrics"}
                </Button>
              ) : null}

              {!watchOnly && biometricEnabled && bioFailures >= 3 ? (
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-caption)",
                    color: "var(--color-text-tertiary)",
                    textAlign: "center",
                  }}
                >
                  {isLinux ? "Quick unlock" : "Biometric unlock"} unavailable for this session.
                </p>
              ) : null}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </FullPage>
  );
}
