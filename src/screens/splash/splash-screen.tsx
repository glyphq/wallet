import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/button";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const MIN_SPLASH_MS = 3000;
const HYDRATION_TIMEOUT_MS = 8000;

const LOADING_MESSAGES = [
  "Checking saved vaults",
  "Restoring local preferences",
  "Preparing the local signing session",
];

export default function SplashScreen() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(() => usePersistedStore.persist.hasHydrated());
  const [hydrationStatus, setHydrationStatus] = useState<"loading" | "stalled" | "error">("loading");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const vaults = usePersistedStore((s) => s.vaults);
  const isLocked = useSessionStore((s) => s.isLocked);
  const [messageIdx, setMessageIdx] = useState(0);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const unsub = usePersistedStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
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
    const timer = setTimeout(() => {
      if (!usePersistedStore.persist.hasHydrated()) {
        setHydrationStatus((status) => status === "error" ? status : "stalled");
      }
    }, HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hydrated, hydrationAttempt]);

  useEffect(() => {
    const id = setInterval(() => setMessageIdx((i) => (i + 1) % LOADING_MESSAGES.length), 1800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = setTimeout(() => {
      if (vaults.length === 0) navigate("/setup", { replace: true });
      else if (isLocked) navigate("/lock", { replace: true });
      else navigate("/dashboard", { replace: true });
    }, remaining);
    return () => clearTimeout(timer);
  }, [hydrated, vaults.length, isLocked, navigate]);

  function retryHydration() {
    setHydrationStatus("loading");
    setHydrationAttempt((attempt) => attempt + 1);
    void usePersistedStore.persist.rehydrate();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-bg-canvas)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "max(var(--space-8), calc(var(--height-titlebar) + var(--space-6))) var(--screen-padding)",
        userSelect: "none",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          width: "100%",
          maxWidth: 320,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-6)",
          textAlign: "center",
        }}
      >
        <BrandLockup align="center" size={56} subtitle="Local control for Qubic" />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-4)",
            width: "100%",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "2px solid var(--color-border-default)",
              borderTopColor: "var(--color-accent)",
              animation: hydrationStatus === "loading" ? "spin 0.8s linear infinite" : "none",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "center" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-title)",
                lineHeight: "var(--leading-tight)",
                letterSpacing: "-0.025em",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              {hydrationStatus === "loading"
                ? "Loading Glyph Wallet"
                : hydrationStatus === "error"
                  ? "Wallet data could not be read"
                  : "Still loading your wallet"}
            </h1>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-text-secondary)",
              }}
            >
              {hydrationStatus === "loading"
                ? LOADING_MESSAGES[messageIdx]
                : "Your encrypted wallet data has not changed. You can try loading it again safely."}
            </p>
          </div>

          {hydrationStatus === "loading" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  lineHeight: "var(--leading-compact)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                Keys remain encrypted on this device.
              </span>
            </div>
          ) : (
            <div role="alert" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", alignItems: "center", width: "100%" }}>
              <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={retryHydration}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
