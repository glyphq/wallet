import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AsciiLogo } from "@/components/ascii-logo";
import { AsciiSpinner } from "@/components/ascii-spinner";
import { LockForm, type FormValues } from "@/screens/lock/lock-form";
import { Button } from "@/components/button";
import RequestScreen from "@/screens/request/request-screen";
import { getThemeVars, THEME_VARS } from "@/lib/appearance";
import { configureApiClient } from "@/lib/api/client";
import { extractMessage } from "@/lib/format";
import { unlockWalletSession } from "@/lib/wallet";
import { acceptDeepLinkPayloadAfterNetworkMatch } from "@/lib/deep-link-acceptance";
import { drainPendingRequests } from "@/lib/pending-request-queue";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } },
});

interface NativeSessionAccount {
  identity: string;
  publicKey: number[];
}

function waitForHydration(): Promise<void> {
  if (usePersistedStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = usePersistedStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

function applyTheme(mode: "dark" | "light") {
  const root = document.documentElement;
  const vars = getThemeVars(mode);
  if (Object.keys(vars).length > 0) {
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  } else {
    for (const key of THEME_VARS) root.style.removeProperty(key);
  }
}

async function closeApprovalWindow() {
  await getCurrentWindow().close().catch(() => {});
}

function CloseRoute() {
  useEffect(() => {
    void closeApprovalWindow();
  }, []);
  return null;
}

function ApprovalShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--color-bg-canvas)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}

export default function ApprovalWindow() {
  const [phase, setPhase] = useState<"loading" | "locked" | "waiting" | "ready">("loading");
  const [reviewKey, setReviewKey] = useState(0);
  const [unlockError, setUnlockError] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const wallets = usePersistedStore((state) => state.wallets);
  const activeWalletId = usePersistedStore((state) => state.settings.activeWalletId);
  const passwordAttempts = usePersistedStore((state) => state.passwordAttempts);
  const setPasswordAttempts = usePersistedStore((state) => state.setPasswordAttempts);
  const setPasswordLockoutUntil = usePersistedStore((state) => state.setPasswordLockoutUntil);
  const setActiveWallet = usePersistedStore((state) => state.setActiveWallet);
  const touchWalletUnlocked = usePersistedStore((state) => state.touchWalletUnlocked);
  const { register, handleSubmit, watch } = useForm<FormValues>();
  const passwordEntered = !!watch("password")?.trim();
  const selectedWallet = wallets
    .slice()
    .sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0))
    .find((wallet) => wallet.id === activeWalletId) ?? wallets.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0))[0];
  const readyRef = useRef(false);
  const drainRef = useRef<Promise<void> | null>(null);

  const drainQueue = useCallback(() => {
    if (!readyRef.current) return Promise.resolve();
    if (drainRef.current) return drainRef.current;

    const settings = usePersistedStore.getState().settings;
    const drain = drainPendingRequests({
      getPendingRequest: () => invoke<string | null>("get_pending_request"),
      acceptPendingRequest: (payload) => acceptDeepLinkPayloadAfterNetworkMatch({
        payload,
        networkSetting: settings.network,
        invokeNative: invoke,
      }),
      onAccepted: (payload) => {
        useSessionStore.getState().enqueuePendingRequest(payload);
        setReviewKey((key) => key + 1);
      },
    });

    drainRef.current = drain;
    void drain.finally(() => {
      if (drainRef.current === drain) drainRef.current = null;
    });
    return drain;
  }, []);

  useEffect(() => {
    const update = () => setLockoutSecsLeft(Math.max(0, Math.ceil((usePersistedStore.getState().passwordLockoutUntil - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function unlockFromApproval({ password }: FormValues) {
    if (!selectedWallet?.encryptedData || !password.trim() || lockoutSecsLeft > 0) return;
    setUnlockLoading(true);
    setUnlockError("");
    try {
      const accounts = await unlockWalletSession(selectedWallet.encryptedData, password);
      useSessionStore.getState().unlock(selectedWallet.id, accounts);
      setActiveWallet(selectedWallet.id);
      touchWalletUnlocked(selectedWallet.id);
      setPasswordAttempts(0);
      setPhase("loading");
      await emit("glyph:session-unlocked", { walletId: selectedWallet.id }).catch(() => {});
    } catch (error) {
      const nextAttempts = passwordAttempts + 1;
      setPasswordAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setPasswordLockoutUntil(Date.now() + 30_000);
        setPasswordAttempts(0);
        setUnlockError("Too many attempts. Wait 30 seconds before trying again.");
      } else {
        setUnlockError(`Wrong password. ${5 - nextAttempts} ${5 - nextAttempts === 1 ? "attempt" : "attempts"} remaining.`);
      }
      setShakeKey((key) => key + 1);
      setUnlockError((message) => message || extractMessage(error));
    } finally {
      setUnlockLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | null = null;
    let unlisten: (() => void) | null = null;
    let listening = true;

    async function readAccounts(): Promise<NativeSessionAccount[]> {
      try {
        return await invoke<NativeSessionAccount[]>("get_session_accounts");
      } catch {
        return [];
      }
    }

    async function waitForUnlockAndActivate() {
      if (cancelled) return;
      const accounts = await readAccounts();
      if (cancelled) return;
      if (accounts.length === 0) {
        setPhase("locked");
        pollTimer = window.setTimeout(waitForUnlockAndActivate, 1_000);
        return;
      }

      const state = usePersistedStore.getState();
      const walletId = state.settings.activeWalletId ?? state.wallets[0]?.id ?? "approval";
      useSessionStore.getState().unlock(walletId, accounts.map((account) => ({
        identity: account.identity,
        publicKey: new Uint8Array(account.publicKey),
      })));
      readyRef.current = true;
      await drainQueue();
      if (!cancelled) {
        setPhase(useSessionStore.getState().pendingRequests.length > 0 ? "ready" : "waiting");
      }
    }

    async function boot() {
      await waitForHydration();
      if (cancelled) return;
      const settings = usePersistedStore.getState().settings;
      configureApiClient(settings.network.apiUrl);
      applyTheme(settings.themeMode);
      await waitForUnlockAndActivate();
    }

    void boot();

    listen("glyph:approval-request", () => {
      void drainQueue().then(() => {
        if (useSessionStore.getState().pendingRequests.length > 0) setPhase("ready");
      });
    }).then((fn) => {
      if (listening) unlisten = fn;
      else fn();
    }).catch(() => {});

    return () => {
      cancelled = true;
      readyRef.current = false;
      listening = false;
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      unlisten?.();
    };
  }, [drainQueue]);

  if (phase === "loading") {
    return (
      <ApprovalShell>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-6)", padding: "var(--space-8)" }}>
          <AsciiLogo />
          <AsciiSpinner size={104} />
          <span role="status" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Preparing secure review
          </span>
        </div>
      </ApprovalShell>
    );
  }

  if (phase === "waiting") {
    return (
      <ApprovalShell>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-5)", padding: "var(--space-8)", textAlign: "center" }}>
          <AsciiLogo />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Waiting for request
          </span>
          <p style={{ margin: 0, maxWidth: 300, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)" }}>
            The review window is ready. The pending request could not be loaded.
          </p>
          <Button variant="secondary" size="md" onClick={() => void closeApprovalWindow()}>
            Close
          </Button>
        </div>
      </ApprovalShell>
    );
  }

  if (phase === "locked") {
    return (
      <ApprovalShell>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-5)", padding: "var(--space-6)", textAlign: "center" }}>
          <AsciiLogo />
          <div>
            <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-status-warning)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Wallet locked
            </span>
            <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)" }}>
              Unlock {selectedWallet?.name ?? "your wallet"} to review this request.
            </p>
          </div>
          <div style={{ width: "100%", maxWidth: 340, textAlign: "left" }}>
            <LockForm
              register={register}
              handleSubmit={handleSubmit}
              onSubmit={(values) => void unlockFromApproval(values)}
              shakeKey={shakeKey}
              error={unlockError}
              lockoutSecsLeft={lockoutSecsLeft}
              loading={unlockLoading}
              biometricEnabled={false}
              bioFailures={0}
              onBiometric={() => {}}
              isLinux={false}
              passwordEntered={passwordEntered}
              secondaryAction={(
                <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={() => void closeApprovalWindow()}>
                  Close
                </Button>
              )}
            />
          </div>
          <p style={{ margin: 0, maxWidth: 300, color: "var(--color-text-tertiary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-body)" }}>
            The main window can stay locked. This review continues as soon as the wallet is unlocked.
          </p>
        </div>
      </ApprovalShell>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter key={reviewKey} initialEntries={["/request"]}>
        <Routes>
          <Route path="/request" element={<RequestScreen />} />
          <Route path="*" element={<CloseRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
