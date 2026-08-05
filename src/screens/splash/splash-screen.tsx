import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/button";
import glyphOnDark from "@/assets/brand/glyph-on-dark.png";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const HYDRATION_TIMEOUT_MS = 8000;

export default function SplashScreen() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(() => usePersistedStore.persist.hasHydrated());
  const [hydrationStatus, setHydrationStatus] = useState<"loading" | "stalled" | "error">("loading");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const vaults = usePersistedStore((s) => s.vaults);
  const isLocked = useSessionStore((s) => s.isLocked);
  const reduceMotion = useReducedMotion();

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
    if (!hydrated) return;
    if (vaults.length === 0) navigate("/setup", { replace: true });
    else if (isLocked) navigate("/lock", { replace: true });
    else navigate("/dashboard", { replace: true });
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
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {hydrationStatus === "loading" ? (
        <div role="status" aria-label="Loading Glyph Wallet" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <motion.img
            src={glyphOnDark}
            alt=""
            aria-hidden="true"
            animate={reduceMotion ? undefined : { opacity: [0.7, 1, 0.7], scale: [0.96, 1, 0.96] }}
            transition={reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 104, height: 104, objectFit: "contain" }}
          />
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
              {hydrationStatus === "error"
                ? "Wallet data could not be read"
                : "Still loading your wallet"}
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: 320,
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                lineHeight: "var(--leading-body)",
                color: "var(--color-text-secondary)",
              }}
            >
              Your encrypted wallet data has not changed. You can try loading it again safely.
            </p>
          </div>

          <div
            role="alert"
            style={{
              width: "100%",
              maxWidth: 320,
            }}
          >
            <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={retryHydration}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
