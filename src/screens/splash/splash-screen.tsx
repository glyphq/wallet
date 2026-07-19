import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/button";
import { FlowHeader } from "@/components/flow-header";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const MIN_SPLASH_MS = 3000;
const HYDRATION_TIMEOUT_MS = 8000;

const FACTS = [
  "Qubic was founded by Sergey Ivancheglo, the original creator of NXT and co-founder of IOTA.",
  "Qubic's Useful Proof-of-Work trains AI models instead of solving arbitrary hashes.",
  "Qubic can process millions of transactions per second on its computor network.",
  "Standard QUBIC transfers are feeless. Smart contract fees are burned.",
  "Qubic launched with no VC funding, no premine, and no ICO.",
  "Exactly 676 validators, called Computors, secure the network.",
  "QUBIC has a fixed supply of 1 quadrillion units with no inflation.",
];

export default function SplashScreen() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(() => usePersistedStore.persist.hasHydrated());
  const [hydrationStatus, setHydrationStatus] = useState<"loading" | "stalled" | "error">("loading");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const vaults = usePersistedStore((s) => s.vaults);
  const isLocked = useSessionStore((s) => s.isLocked);
  const [factIdx, setFactIdx] = useState(0);
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
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4000);
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
        justifyContent: "space-between",
        padding: "max(var(--space-8), calc(var(--height-titlebar) + var(--space-6))) var(--screen-padding) var(--space-8)",
        userSelect: "none",
      }}
    >
      <div />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        style={{
          width: "100%",
          maxWidth: 340,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-8)",
        }}
      >
        <BrandLockup align="center" size={56} subtitle="Local control for Qubic" />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            padding: "var(--space-6)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border-default)",
            borderRadius: "var(--radius-sheet)",
          }}
        >
          <FlowHeader
            align="center"
            eyebrow="Startup"
            title={hydrationStatus === "loading" ? "Loading your wallet" : hydrationStatus === "error" ? "Wallet data could not be read" : "Wallet data is taking longer than expected"}
            description={hydrationStatus === "loading"
              ? "Keys remain encrypted on this device. The wallet is loading saved state before opening."
              : "Your encrypted wallet data has not been changed. Try loading it again."}
          />

          {hydrationStatus === "loading" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", alignItems: "center" }}>
              <div
                aria-hidden="true"
                style={{
                  width: "100%",
                  height: 4,
                  background: "var(--color-bg-elevated)",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <motion.div
                  animate={{ x: ["-100%", "120%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    width: "42%",
                    height: "100%",
                    background: "var(--color-accent)",
                    borderRadius: 999,
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-mono-sm)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                Reading local state
              </span>
            </div>
          ) : (
            <div role="alert" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", alignItems: "center" }}>
              <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={retryHydration}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      <div
        style={{
          width: "100%",
          maxWidth: 340,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-caption)",
            lineHeight: "var(--leading-compact)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-tertiary)",
          }}
        >
          Network context
        </span>
        <AnimatePresence mode="wait">
          <motion.p
            key={factIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{
              margin: 0,
              minHeight: 54,
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body-compact)",
              lineHeight: "var(--leading-body)",
              color: "var(--color-text-secondary)",
            }}
          >
            {FACTS[factIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
