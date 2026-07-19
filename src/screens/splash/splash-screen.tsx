import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { Button } from "@/components/button";

const MIN_SPLASH_MS = 3000;
const HYDRATION_TIMEOUT_MS = 8000;

const FACTS = [
  "Qubic is founded by Sergey Ivancheglo — the original creator of NXT and co-founder of IOTA.",
  "Qubic's Useful Proof-of-Work trains AI models instead of solving arbitrary puzzles.",
  "CertiK-verified: Qubic peaks at 15.5 million transactions per second.",
  "Standard QUBIC transfers are completely feeless. Smart contract fees are burned.",
  "Qubic launched with zero VC funding, no pre-mine, and no ICO.",
  "Exactly 676 validators called Computors secure the network.",
  "There is a fixed supply of 1 quadrillion QUBIC — no inflation, ever.",
];

export default function SplashScreen() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(() => usePersistedStore.persist.hasHydrated());
  const [hydrationStatus, setHydrationStatus] = useState<"loading" | "stalled" | "error">("loading");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const vaults = usePersistedStore((s) => s.vaults);
  const isLocked = useSessionStore((s) => s.isLocked);
  const [factIdx, setFactIdx] = useState(0);

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

  const mountedAt = useRef(Date.now());

  function retryHydration() {
    setHydrationStatus("loading");
    setHydrationAttempt((attempt) => attempt + 1);
    void usePersistedStore.persist.rehydrate();
  }

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

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--color-bg-base)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "var(--space-8)",
      userSelect: "none",
    }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)" }}
      >
        {/* Logo + wordmark */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "var(--space-3)" }}>
          <img src="/icon.png" width={48} height={48} alt="" style={{ borderRadius: "var(--radius-sharp)" }} />
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "var(--color-text-display)",
            letterSpacing: "-0.01em",
          }}>
            Glyph Wallet
          </span>
        </div>

        {hydrationStatus === "loading" ? (
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "var(--color-text-disabled)",
                }}
              />
            ))}
          </div>
        ) : (
          <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)", maxWidth: 280, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)" }}>
              {hydrationStatus === "error" ? "Wallet data could not be read" : "Wallet data is taking longer than expected"}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              Your encrypted wallet data has not been changed. Try loading it again.
            </div>
            <Button variant="secondary" size="lg" shape="sharp" style={{ width: "auto" }} onClick={retryHydration}>
              Try again
            </Button>
          </div>
        )}
      </motion.div>

      {/* Bottom: cycling fact */}
      <div style={{
        position: "absolute",
        bottom: "var(--space-8)",
        left: "var(--space-8)",
        right: "var(--space-8)",
      }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={factIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-caption)",
              color: "var(--color-text-disabled)",
              lineHeight: 1.6,
              textAlign: "center",
              margin: 0,
            }}
          >
            {FACTS[factIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
