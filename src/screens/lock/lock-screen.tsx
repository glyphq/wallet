import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useForm } from "react-hook-form";
import { invoke } from "@tauri-apps/api/core";
import { FullPage } from "@/layouts/full-page";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { AddCircleIcon, ChevronLeft01Icon, ChevronRight01Icon, Exchange01Icon, Notification01Icon } from "@/lib/icons";
import { PageBanner } from "@/components/page-header";
import { recordAuditEvent } from "@/lib/audit-log";
import { extractMessage } from "@/lib/format";
import { stepMotion } from "@/lib/animations";
import { unlockBiometricSession, unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import type { SessionAccount } from "@/lib/session-account";
import { LockForm, type FormValues } from "./lock-form";
import { LockWalletFocus } from "./lock-wallet-focus";
import { LockWalletShelf } from "./lock-wallet-shelf";
import { UnlockingPanel } from "./lock-unlocking-panel";

const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_SECS = 30;
let biometricFailures = 0;

function PendingRequestNotch({ count }: { count: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "4px 10px",
        background: "var(--color-bg-nav)",
        borderLeft: "1px solid var(--color-border-subtle)",
        borderTop: "1px solid var(--color-border-subtle)",
        borderRight: "1px solid var(--color-border-subtle)",
        borderBottom: "none",
        borderRadius: "var(--radius-sharp) var(--radius-sharp) 0 0",
        color: "var(--color-accent)",
      }}
    >
      <Notification01Icon size={13} aria-hidden="true" />
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", fontVariantNumeric: "tabular-nums", color: "var(--color-accent)", fontWeight: 600 }}>
        {count}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {count === 1 ? "pending request" : "pending requests"}
      </span>
    </div>
  );
}

export default function LockScreen() {
  const navigate = useNavigate();
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveWallet = usePersistedStore((s) => s.setActiveWallet);
  const touchWalletUnlocked = usePersistedStore((s) => s.touchWalletUnlocked);
  const passwordLockoutUntil = usePersistedStore((s) => s.passwordLockoutUntil);
  const setPasswordLockoutUntil = usePersistedStore((s) => s.setPasswordLockoutUntil);
  const passwordAttempts = usePersistedStore((s) => s.passwordAttempts);
  const setPasswordAttempts = usePersistedStore((s) => s.setPasswordAttempts);
  const unlock = useSessionStore((s) => s.unlock);
  const pendingRequestCount = useSessionStore((s) => s.pendingRequests.length);
  const hasPendingRequest = pendingRequestCount > 0;

  const lockedWallets = wallets
    .slice()
    .sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));
  useEffect(() => {
    if (wallets.length > 0 && lockedWallets.length === 0) {
      navigate("/setup", { replace: true });
    }
  }, [wallets.length, lockedWallets.length, navigate]);

  const [selectedId, setSelectedId] = useState<string>(() => lockedWallets[0]?.id ?? "");
  const [view, setView] = useState<"unlock" | "switch">("unlock");
  const selected = lockedWallets.find((wallet) => wallet.id === selectedId) ?? lockedWallets[0];
  const biometricEnabled = selected ? (settings.biometricWalletIds ?? []).includes(selected.id) : false;

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bioFailures, setBioFailures] = useState(biometricFailures);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const lockoutRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const { register, handleSubmit, setValue, setFocus, watch } = useForm<FormValues>();
  const passwordEntered = !!watch("password")?.trim();

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

  function cycleWallet(direction: -1 | 1) {
    if (lockedWallets.length < 2) return;
    const index = lockedWallets.findIndex((wallet) => wallet.id === selected.id);
    const next = lockedWallets[(index + direction + lockedWallets.length) % lockedWallets.length];
    setSelectedId(next.id);
    setView("unlock");
  }

  async function finishUnlock(wallets: SessionAccount[]) {
    if (!selected) return;
    setActiveWallet(selected.id);
    unlock(selected.id, wallets);
    touchWalletUnlocked(selected.id);
    recordAuditEvent({
      kind: "unlock_succeeded",
      status: "success",
      title: "Wallet unlocked",
      detail: selected.name,
      walletId: selected.id,
    });
    biometricFailures = 0;
    setPasswordAttempts(0);
    setUnlocking(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 180));
    navigate(hasPendingRequest ? "/request" : "/dashboard", { replace: true });
  }

  async function doUnlock(password: string) {
    if (!selected || !selected.encryptedData) return;
    const wallets = await unlockWalletSession(selected.encryptedData, password);
    await invoke("disable_biometric", { walletId: selected.id }).catch(() => {});
    await finishUnlock(wallets);
  }

  async function onSubmit({ password }: FormValues) {
    if (!selected || !password.trim() || lockoutSecsLeft > 0) return;
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
        walletId: selected.id,
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
      const wallets = await unlockBiometricSession(selected.id, selected.encryptedData);
      await finishUnlock(wallets);
    } catch (event) {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Biometric unlock failed",
        detail: selected.name,
        walletId: selected.id,
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

  const bannerTitle = view === "switch" ? "Switch wallet" : "Unlock wallet";
  const bannerDescription = view === "switch"
    ? "Choose a wallet to unlock."
    : hasPendingRequest
      ? "Unlock to review a pending request."
      : "Enter the password for your last used wallet.";

  const actions = view === "unlock" ? (
    <LockForm
      register={register}
      handleSubmit={handleSubmit}
      onSubmit={onSubmit}
      shakeKey={shakeKey}
      error={error}
      lockoutSecsLeft={lockoutSecsLeft}
      loading={loading}
      biometricEnabled={biometricEnabled}
      bioFailures={bioFailures}
      onBiometric={onBiometric}
      isLinux={isLinux}
      passwordEntered={passwordEntered}
      secondaryAction={(
        <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={() => setView("switch")}>
          <Exchange01Icon size={18} aria-hidden="true" />
          Switch wallet
        </Button>
      )}
    />
  ) : (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Button size="md" style={{ width: "100%" }} onClick={() => navigate("/setup")}>
        <AddCircleIcon size={18} aria-hidden="true" />
        Add wallet
      </Button>
      <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => setView("unlock")}>
        Back to unlock
      </Button>
    </div>
  );

  return (
    <FullPage centered={false} style={{ padding: 0 }}>
      {unlocking ? (
        <UnlockingPanel />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            {...stepMotion}
            style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
          >
          <PageBanner
            title={view === "switch" ? bannerTitle : undefined}
            description={view === "switch" ? bannerDescription : undefined}
            centered={view === "unlock"}
            showBrand={view !== "unlock"}
            bottomNotch={hasPendingRequest ? <PendingRequestNotch count={pendingRequestCount} /> : undefined}
            style={
              view === "unlock"
                ? { flex: 1, minHeight: 0, height: "auto", borderBottom: "none" }
                : { borderBottom: "1px solid var(--color-border-subtle)" }
            }
          >
            {view === "unlock" ? (
              <div style={{ marginTop: "var(--space-3)", width: "100%", position: "relative" }}>
                {lockedWallets.length > 1 ? (
                  <IconButton
                    label="Previous wallet"
                    onClick={() => cycleWallet(-1)}
                    style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 36, height: 36 }}
                  >
                    <ChevronLeft01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                  </IconButton>
                ) : null}
                <LockWalletFocus wallet={selected} />
                {lockedWallets.length > 1 ? (
                  <IconButton
                    label="Next wallet"
                    onClick={() => cycleWallet(1)}
                    style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 36, height: 36 }}
                  >
                    <ChevronRight01Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                  </IconButton>
                ) : null}
              </div>
            ) : null}
          </PageBanner>

          {view === "switch" ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-4)" }}>
              <div style={{ width: "100%", maxWidth: 340, margin: "0 auto" }}>
                <LockWalletShelf
                  wallets={lockedWallets}
                  selectedId={selected.id}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setView("unlock");
                    window.setTimeout(() => setFocus("password"), 240);
                  }}
                />
              </div>
            </div>
          ) : null}

          <div className="page-frame-actions">
            <div className="page-frame-actions-inner">{actions}</div>
          </div>
          </motion.div>
        </AnimatePresence>
      )}
    </FullPage>
  );
}