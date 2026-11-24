import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AsciiBackdrop } from "@/components/ascii-backdrop";
import { AsciiSpinner } from "@/components/ascii-spinner";
import { Button } from "@/components/button";
import { FieldLabel } from "@/components/field-parts";
import { Identicon } from "@/components/identicon";
import { BrandLockup } from "@/components/brand-lockup";
import { Input } from "@/components/input";
import RequestScreen from "@/screens/request/request-screen";
import { ReviewModeProvider } from "@/screens/request/review-mode";
import { getThemeVars, THEME_VARS } from "@/lib/appearance";
import { configureApiClient } from "@/lib/api/client";
import { extractMessage } from "@/lib/format";
import { LockKeyholeIcon, ViewIcon, ViewOffIcon } from "@/lib/icons";
import { acceptDeepLinkPayloadAfterNetworkMatch } from "@/lib/deep-link-acceptance";
import { drainPendingRequests } from "@/lib/pending-request-queue";
import { parseGlyphEnvelope } from "@/lib/request-schema";
import { unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } },
});

interface NativeSessionAccount {
  identity: string;
  publicKey: number[];
}

interface ApprovalFormValues {
  password: string;
}

async function pendingRequiredIdentity(): Promise<string | null> {
  const raw = await invoke<string | null>("get_pending_request").catch(() => null);
  if (!raw) return null;
  const request = parseGlyphEnvelope(raw).envelope?.request;
  return request && "from" in request && typeof request.from === "string" ? request.from : null;
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

function PasswordVisibilityButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
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
      {visible ? <ViewOffIcon size={18} strokeWidth={1.5} /> : <ViewIcon size={18} strokeWidth={1.5} />}
    </button>
  );
}

function ApprovalShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--color-bg-canvas)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="approval-surface" style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
    </div>
  );
}

function ApprovalAsciiHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ position: "relative", height: 92, flexShrink: 0, borderBottom: "1px solid var(--color-border-subtle)" }}>
      <AsciiBackdrop
        style={{ position: "absolute", inset: 0 }}
        contentStyle={{ height: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", padding: "0 22px" }}
      >
        <div className="asciify-clear">
          <BrandLockup size={30} title="Glyph" subtitle="Review" compact />
        </div>
        <div className="asciify-clear" style={{ textAlign: "right" }}>
          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
            {eyebrow}
          </span>
          <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.05, letterSpacing: "-0.025em", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {title}
          </h1>
        </div>
      </AsciiBackdrop>
    </div>
  );
}

function ApprovalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-frame-actions">
      <div className="page-frame-actions-inner" style={{ display: "flex", gap: "var(--space-3)" }}>
        {children}
      </div>
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
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const wallets = usePersistedStore((state) => state.wallets);
  const activeWalletId = usePersistedStore((state) => state.settings.activeWalletId);
  const passwordAttempts = usePersistedStore((state) => state.passwordAttempts);
  const setPasswordAttempts = usePersistedStore((state) => state.setPasswordAttempts);
  const setPasswordLockoutUntil = usePersistedStore((state) => state.setPasswordLockoutUntil);
  const setActiveWallet = usePersistedStore((state) => state.setActiveWallet);
  const touchWalletUnlocked = usePersistedStore((state) => state.touchWalletUnlocked);
  const { register, handleSubmit, watch, setValue } = useForm<ApprovalFormValues>();
  const passwordEntered = !!watch("password")?.trim();
  const selectedWallet =
    wallets.find((wallet) => wallet.id === selectedWalletId) ??
    wallets.find((wallet) => wallet.id === activeWalletId) ??
    wallets[0];
  const sessionWalletRef = useRef<string | null>(null);
  const autoSelectedRef = useRef(false);
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

  useEffect(() => {
    if (selectedWalletId && wallets.some((wallet) => wallet.id === selectedWalletId)) return;
    const fallback = activeWalletId && wallets.some((wallet) => wallet.id === activeWalletId)
      ? activeWalletId
      : wallets[0]?.id ?? "";
    setSelectedWalletId(fallback);
  }, [activeWalletId, selectedWalletId, wallets]);

  useEffect(() => {
    if (autoSelectedRef.current || wallets.length === 0) return;
    void (async () => {
      const requiredIdentity = await pendingRequiredIdentity();
      if (!requiredIdentity) return;
      const owner = wallets.find((wallet) => wallet.accounts.some((account) => account.identity === requiredIdentity));
      if (!owner) return;
      autoSelectedRef.current = true;
      setSelectedWalletId(owner.id);
    })();
  }, [wallets]);

  useEffect(() => {
    setValue("password", "");
    setUnlockError("");
    setShowPassword(false);
  }, [selectedWalletId, setValue]);

  async function unlockFromApproval({ password }: ApprovalFormValues) {
    if (!selectedWallet?.encryptedData || !password.trim() || lockoutSecsLeft > 0) return;
    setUnlockLoading(true);
    setUnlockError("");
    try {
      const accounts = await unlockWalletSession(selectedWallet.encryptedData, password);
      sessionWalletRef.current = selectedWallet.id;
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
      const requiredIdentity = await pendingRequiredIdentity();
      const coversRequiredIdentity = !requiredIdentity || accounts.some((account) => account.identity === requiredIdentity);
      if (accounts.length === 0 || !coversRequiredIdentity) {
        if (requiredIdentity) {
          const owner = usePersistedStore.getState().wallets.find((wallet) => wallet.accounts.some((account) => account.identity === requiredIdentity));
          if (owner) setSelectedWalletId(owner.id);
        }
        setPhase("locked");
        pollTimer = window.setTimeout(waitForUnlockAndActivate, 1_000);
        return;
      }

      const state = usePersistedStore.getState();
      const walletId = sessionWalletRef.current ?? state.settings.activeWalletId ?? state.wallets[0]?.id ?? "approval";
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
      void (async () => {
        try { await usePersistedStore.persist.rehydrate(); } catch {}
        await waitForHydration();
        if (useSessionStore.getState().pendingRequests.length === 0) {
          const accounts = await readAccounts();
          const requiredIdentity = await pendingRequiredIdentity();
          if (requiredIdentity && !accounts.some((account) => account.identity === requiredIdentity)) {
            const owner = usePersistedStore.getState().wallets.find((wallet) => wallet.accounts.some((account) => account.identity === requiredIdentity));
            if (owner) setSelectedWalletId(owner.id);
            setPhase("locked");
            return;
          }
        }
        await drainQueue();
        if (useSessionStore.getState().pendingRequests.length > 0) setPhase("ready");
      })();
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
        <ApprovalAsciiHeader eyebrow="Secure review" title="Preparing" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-4)" }}>
          <AsciiSpinner size={64} />
          <span role="status" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Preparing secure review
          </span>
        </div>
      </ApprovalShell>
    );
  }

  if (phase === "waiting") {
    return (
      <ApprovalShell>
        <ApprovalAsciiHeader eyebrow="Review window" title="No request" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-3)", padding: "var(--space-6)", textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Waiting for request
          </span>
          <p style={{ margin: 0, maxWidth: 320, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.45 }}>
            A dApp request will appear here when it arrives.
          </p>
        </div>
        <ApprovalFooter>
          <Button variant="secondary" onClick={() => void closeApprovalWindow()} style={{ flex: 1 }}>
            Close
          </Button>
        </ApprovalFooter>
      </ApprovalShell>
    );
  }

  if (phase === "locked") {
    return (
      <ApprovalShell>
        <ApprovalAsciiHeader eyebrow="DApp review" title={wallets.length > 0 ? "Unlock to review" : "No wallet"} />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "var(--space-3)", width: "100%", maxWidth: 500, margin: "0 auto" }}>
          {wallets.length > 0 ? (
            <>
              {selectedWallet ? (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Identicon kind="wallet" seed={`${selectedWallet.id}:${selectedWallet.color}`} label={selectedWallet.name} size={44} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedWallet.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-tertiary)", letterSpacing: "0.05em" }}>{selectedWallet.accounts.length} {selectedWallet.accounts.length === 1 ? "identity" : "identities"}</div>
                  </div>
                </div>
              ) : null}
              <div>
                <FieldLabel htmlFor="approval-wallet">Wallet</FieldLabel>
                <select
                  id="approval-wallet"
                  value={selectedWallet?.id ?? ""}
                  onChange={(event) => setSelectedWalletId(event.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 36,
                    marginTop: "var(--space-2)",
                    padding: "0 10px",
                    borderRadius: "var(--radius-sharp)",
                    border: "1px solid var(--color-border-strong)",
                    background: "var(--color-bg-base)",
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                >
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} · {wallet.accounts.length} {wallet.accounts.length === 1 ? "identity" : "identities"}
                    </option>
                  ))}
                </select>
              </div>
              <form id="approval-unlock" onSubmit={handleSubmit((values) => void unlockFromApproval(values))} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div key={shakeKey} className={unlockError ? "lock-shake" : undefined}>
                  <Input
                    {...register("password")}
                    id="approval-password"
                    aria-label="Wallet password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter the wallet password"
                    autoComplete="current-password"
                    autoFocus
                    error={lockoutSecsLeft > 0 ? `Locked. Try again in ${lockoutSecsLeft} seconds.` : unlockError}
                    disabled={lockoutSecsLeft > 0}
                    leftElement={<LockKeyholeIcon size={18} strokeWidth={1.5} />}
                    rightElement={<PasswordVisibilityButton visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} />}
                  />
                </div>
              </form>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--color-text-tertiary)", textTransform: "uppercase", textAlign: "center" }}>
                All identities in this wallet unlock together
              </span>
            </>
          ) : (
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 12, lineHeight: 1.45, color: "var(--color-text-secondary)" }}>
              Open Glyph and add a wallet to review this request.
            </p>
          )}
        </div>
        <ApprovalFooter>
          <Button variant="secondary" onClick={() => void closeApprovalWindow()} style={{ flex: 1 }}>
            Close
          </Button>
          {wallets.length > 0 ? (
            <Button
              type="submit"
              form="approval-unlock"
              loading={unlockLoading}
              disabled={lockoutSecsLeft > 0 || !passwordEntered || !selectedWallet?.encryptedData}
              style={{ flex: 1 }}
            >
              <LockKeyholeIcon size={16} strokeWidth={1.5} aria-hidden="true" />
              Unlock wallet
            </Button>
          ) : null}
        </ApprovalFooter>
      </ApprovalShell>
    );
  }

  return (
    <ApprovalShell>
      <QueryClientProvider client={queryClient}>
        <ReviewModeProvider approvalWindow>
          <div style={{ height: "100%" }}>
            <MemoryRouter key={reviewKey} initialEntries={["/request"]}>
              <Routes>
                <Route path="/request" element={<RequestScreen />} />
                <Route path="*" element={<CloseRoute />} />
              </Routes>
            </MemoryRouter>
          </div>
        </ReviewModeProvider>
      </QueryClientProvider>
    </ApprovalShell>
  );
}
