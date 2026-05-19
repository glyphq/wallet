import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

export default function RootScreen() {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(() =>
    usePersistedStore.persist.hasHydrated()
  );
  const vaults = usePersistedStore((s) => s.vaults);
  const isLocked = useSessionStore((s) => s.isLocked);

  useEffect(() => {
    console.log("[root] mount — hasHydrated:", usePersistedStore.persist.hasHydrated());
    const unsub = usePersistedStore.persist.onFinishHydration(() => {
      console.log("[root] onFinishHydration fired");
      setHydrated(true);
    });
    const current = usePersistedStore.persist.hasHydrated();
    console.log("[root] setting hydrated:", current);
    setHydrated(current);
    // Belt-and-suspenders: if IPC never completes, unblock navigation after 4s
    const timer = setTimeout(() => {
      console.log("[root] hydration timeout — forcing hydrated=true");
      setHydrated(true);
    }, 4000);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    console.log("[root] nav effect — hydrated:", hydrated, "vaults:", vaults.length, "locked:", isLocked);
    if (!hydrated) return;
    if (vaults.length === 0) {
      console.log("[root] navigating → /setup");
      navigate("/setup", { replace: true });
    } else if (isLocked) {
      console.log("[root] navigating → /lock");
      navigate("/lock", { replace: true });
    } else {
      console.log("[root] navigating → /dashboard");
      navigate("/dashboard", { replace: true });
    }
  }, [hydrated, vaults.length, isLocked, navigate]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        color: "var(--color-text-disabled)",
        letterSpacing: "0.05em",
      }}
    >
      [LOADING...]
      <span style={{ fontSize: "10px", opacity: 0.6 }}>
        hydrated={String(hydrated)} vaults={vaults.length} locked={String(isLocked)}
      </span>
    </div>
  );
}
