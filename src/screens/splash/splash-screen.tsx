import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Button } from "@/components/button";
import { Clock01Icon, Download01Icon } from "@/lib/icons";
import { AsciiLogo } from "@/components/ascii-logo";
import { AsciiSpinner } from "@/components/ascii-spinner";
import { useUpdater } from "@/hooks/use-updater";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const MIN_SPLASH_MS = 2_500;
const HYDRATION_TIMEOUT_MS = 8_000;

export default function SplashScreen() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(() => usePersistedStore.persist.hasHydrated());
  const [hydrationStatus, setHydrationStatus] = useState<"loading" | "stalled" | "error">("loading");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [updateDeferred, setUpdateDeferred] = useState(false);
  const wallets = usePersistedStore((s) => s.wallets);
  const isLocked = useSessionStore((s) => s.isLocked);
  const updater = useUpdater();

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = usePersistedStore.persist.onFinishHydration(() => setHydrated(true));
    const handleReadError = () => setHydrationStatus("error");
    window.addEventListener("glyph:disk-read-error", handleReadError);
    if (usePersistedStore.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsub();
      window.removeEventListener("glyph:disk-read-error", handleReadError);
    };
  }, []);

  useEffect(() => {
    if (hydrated) return;
    const timer = window.setTimeout(() => {
      if (!usePersistedStore.persist.hasHydrated()) {
        setHydrationStatus((status) => status === "error" ? status : "stalled");
      }
    }, HYDRATION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [hydrated, hydrationAttempt]);

  useEffect(() => {
    if (!hydrated || !minElapsed || hydrationStatus !== "loading") return;
    if (updater.checking || updater.installing) return;
    if (updater.update && !updateDeferred) return;
    if (wallets.length === 0) navigate("/setup", { replace: true });
    else if (isLocked) navigate("/lock", { replace: true });
    else navigate("/dashboard", { replace: true });
  }, [hydrated, minElapsed, hydrationStatus, updater.checking, updater.installing, updater.update, updateDeferred, wallets.length, isLocked, navigate]);

  function retryHydration() {
    setHydrationStatus("loading");
    setHydrationAttempt((attempt) => attempt + 1);
    void usePersistedStore.persist.rehydrate();
  }

  const checkingVisible = updater.checking || !minElapsed;
  const status = checkingVisible
    ? "Checking for updates…"
    : updater.installing
      ? `Installing update… ${updater.progress}%`
      : updater.update && !updateDeferred
        ? `Glyph ${updater.update.version} is available`
        : "Loading your wallet";

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--color-bg-canvas)", overflow: "hidden", userSelect: "none" }}>
      {hydrationStatus === "loading" ? (
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-6)",
              padding: "var(--space-8) var(--screen-padding)",
            }}
          >
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: "easeOut" }}>
              <AsciiLogo />
            </motion.div>

            {minElapsed && updater.update && !updateDeferred ? (
              <span role="status" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)", textAlign: "center" }}>
                Glyph {updater.update.version} is ready to install.
              </span>
            ) : checkingVisible || updater.installing ? (
              <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 104 }}>
                <AsciiSpinner size={104} />
                <span className="sr-only">{status}</span>
              </div>
            ) : (
              <span role="status" aria-live="polite" className="sr-only">{status}</span>
            )}
          </div>

          {minElapsed && updater.update && !updateDeferred ? (
            <div style={{ flexShrink: 0, padding: "var(--space-4) var(--screen-padding) var(--space-6)", borderTop: "1px solid var(--color-border-subtle)", background: "var(--color-bg-canvas)" }}>
              <div style={{ width: "100%", maxWidth: 360, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <Button size="md" style={{ width: "100%" }} onClick={() => void updater.install()} loading={updater.installing}>
                  <Download01Icon size={16} aria-hidden="true" />
                  {updater.installing ? updater.progress > 0 ? `Installing ${updater.progress}%` : "Installing" : "Update now"}
                </Button>
                <Button size="md" variant="secondary" style={{ width: "100%" }} onClick={() => setUpdateDeferred(true)} disabled={updater.installing}>
                  <Clock01Icon size={16} aria-hidden="true" />
                  Later
                </Button>
                {updater.installError ? (
                  <span role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)", textAlign: "center" }}>
                    {updater.lastError || "Update failed. Try again later."}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "var(--space-6)",
            padding: "max(var(--space-8), calc(var(--height-titlebar) + var(--space-6))) var(--screen-padding)",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title)", lineHeight: "var(--leading-tight)", letterSpacing: "-0.025em", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {hydrationStatus === "error" ? "Wallet data could not be read" : "Still loading your wallet"}
            </h1>
            <p style={{ margin: 0, maxWidth: 320, fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: "var(--leading-body)", color: "var(--color-text-secondary)" }}>
              Your encrypted wallet data has not changed. You can try loading it again safely.
            </p>
          </div>

          <div role="alert" style={{ width: "100%", maxWidth: 320 }}>
            <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={retryHydration}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
