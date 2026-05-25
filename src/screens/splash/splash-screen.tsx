import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const FACTS = [
  "Qubic is founded by Sergey Ivancheglo — the original creator of NXT and co-founder of IOTA.",
  "Qubic's Useful Proof-of-Work trains AI models instead of solving arbitrary puzzles.",
  "CertiK-verified: Qubic peaks at 15.5 million transactions per second — one of the fastest networks ever built.",
  "Standard QUBIC transfers are completely feeless. Smart contract fees are burned to control supply.",
  "Qubic launched with zero VC funding, no pre-mine, and no ICO — fully community-driven from day one.",
  "Qubic nodes run on bare-metal hardware with no virtual machines, minimizing latency to the absolute floor.",
  "Exactly 676 validators called Computors secure the network. The bottom performers are rotated out every week.",
  "Qubic has mined other networks like Monero with its decentralized compute, then used the proceeds to buy and burn QUBIC.",
  "The top 451 of 676 Computors reach quorum each tick — roughly every 1.5 seconds.",
  "There is a fixed supply of 1 quadrillion QUBIC — no inflation, ever.",
];

export default function SplashScreen() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(() => usePersistedStore.persist.hasHydrated());
  const vaults = usePersistedStore((s) => s.vaults);
  const isLocked = useSessionStore((s) => s.isLocked);
  const [factIdx, setFactIdx] = useState(0);

  // Hydration
  useEffect(() => {
    const unsub = usePersistedStore.persist.onFinishHydration(() => {
      setHydrated((prev) => (prev ? prev : true));
    });
    if (usePersistedStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    const timer = setTimeout(() => {
      setHydrated((prev) => (prev ? prev : true));
    }, 3000);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  // Cycle fun facts
  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const delay = 600;
    const timer = setTimeout(() => {
      if (vaults.length === 0) navigate("/setup", { replace: true });
      else if (isLocked) navigate("/lock", { replace: true });
      else navigate("/dashboard", { replace: true });
    }, delay);
    return () => clearTimeout(timer);
  }, [hydrated, vaults.length, isLocked, navigate]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-12) var(--space-8)",
        userSelect: "none",
      }}
    >
      {/* Logo */}
      <div />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-3)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.2em" }}>
          SIGIL
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-headline)", fontWeight: 500, color: "var(--color-text-display)", textAlign: "center" }}>
          Your keys.<br />Your Qubic.
        </div>
      </div>

      {/* Bottom: fact + progress */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* Fun fact */}
        <p
          key={factIdx}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-mono-sm)",
            color: "var(--color-text-disabled)",
            letterSpacing: "0.04em",
            lineHeight: 1.6,
            textAlign: "center",
            margin: 0,
            animation: "fadein 0.4s ease",
          }}
        >
          {FACTS[factIdx]}
        </p>

        {/* Status */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.08em", textAlign: "center" }}>
          {hydrated ? "OPENING WALLET..." : "LOADING VAULTS..."}
        </div>
      </div>

      <style>{`@keyframes fadein { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
