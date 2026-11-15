import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "motion/react";
import { presets } from "@/lib/animations";
import { FullPage } from "@/layouts/full-page";
import { BrandLockup } from "@/components/brand-lockup";
import { FlowHeader } from "@/components/flow-header";
import { recordAuditEvent } from "@/lib/audit-log";
import { extractMessage } from "@/lib/format";
import { unlockBiometricSession, unlockVaultSession } from "@/lib/vault";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import type { SessionWallet } from "@/lib/session-wallet";
import { LockForm, type FormValues } from "./lock-form";
import { LockVaultShelf } from "./lock-vault-shelf";
import { UnlockingPanel } from "./lock-unlocking-panel";

const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_SECS = 30;
let biometricFailures = 0;

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
    .slice()
    .sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));
  useEffect(() => {
    if (vaults.length > 0 && lockedVaults.length === 0) {
      navigate("/setup", { replace: true });
    }
  }, [vaults.length, lockedVaults.length, navigate]);

  const [selectedId, setSelectedId] = useState<string>(() => lockedVaults[0]?.id ?? "");
  const selected = lockedVaults.find((vault) => vault.id === selectedId) ?? lockedVaults[0];
  const biometricEnabled = selected ? (settings.biometricVaultIds ?? []).includes(selected.id) : false;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioFailures, setBioFailures] = useState(biometricFailures);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const { register, handleSubmit, setValue, setFocus } = useForm<FormValues>();

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

  async function finishUnlock(wallets: SessionWallet[]) {
    if (!selected) return;
    setActiveVault(selected.id);
    unlock(selected.id, wallets);
    touchVaultUnlocked(selected.id);
    recordAuditEvent({
      kind: "unlock_succeeded",
      status: "success",
      title: "Vault unlocked",
      detail: selected.name,
      vaultId: selected.id,
    });
    biometricFailures = 0;
    setPasswordAttempts(0);
    setUnlocking(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 180));
    navigate(hasPendingRequest ? "/request" : "/dashboard", { replace: true });
  }

  async function doUnlock(password: string) {
    if (!selected || !selected.encryptedData) return;
    const wallets = await unlockVaultSession(selected.encryptedData, password);
    await invoke("disable_biometric", { vaultId: selected.id }).catch(() => {});
    await finishUnlock(wallets);
  }

  async function onSubmit({ password }: FormValues) {
    if (!selected || lockoutSecsLeft > 0) return;
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
      setError("Vault data is missing. Re-import the Vault and try again.");
      setLoading(false);
      return;
    }
    try {
      const wallets = await unlockBiometricSession(selected.id, selected.encryptedData);
      await finishUnlock(wallets);
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
    <FullPage centered={false} style={{ justifyContent: "flex-start", paddingTop: "var(--space-6)", paddingBottom: "var(--space-6)" }}>
      <AnimatePresence mode="wait">
        {unlocking ? (
          <UnlockingPanel key="unlocking" />
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
              gap: "var(--space-6)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flexShrink: 0, minHeight: 0 }}>
              <BrandLockup align="center" compact iconOnly />
              <FlowHeader
                align="center"
                title="Unlock Vault"
                description={hasPendingRequest ? "Unlock to review a pending request." : "Choose a Vault, then enter its password."}
              />

              <LockVaultShelf
                vaults={lockedVaults}
                selectedId={selected.id}
                onSelect={(id) => {
                  setSelectedId(id);
                  window.requestAnimationFrame(() => setFocus("password"));
                }}
                onAdd={() => navigate("/setup")}
              />
            </div>

            <LockForm
              register={register}
              handleSubmit={handleSubmit}
              onSubmit={onSubmit}
              showPassword={showPassword}
              onToggleShowPassword={() => setShowPassword((visible) => !visible)}
              shakeKey={shakeKey}
              error={error}
              lockoutSecsLeft={lockoutSecsLeft}
              loading={loading}
              biometricEnabled={biometricEnabled}
              bioFailures={bioFailures}
              onBiometric={onBiometric}
              isLinux={isLinux}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </FullPage>
  );
}
