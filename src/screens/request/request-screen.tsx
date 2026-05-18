import { useNavigate } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { useSessionStore } from "@/store/session";
import { useAutoLock } from "@/hooks/use-auto-lock";

export default function RequestScreen() {
  const navigate = useNavigate();
  useAutoLock();

  const pendingRequest = useSessionStore((s) => s.pendingRequest);

  const statusBar = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em", padding: 0 }}
      >
        ← BACK
      </button>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Sign Request
      </span>
      <span style={{ width: 40 }} />
    </div>
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ textAlign: "center", padding: "var(--space-12) 0", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
        {pendingRequest ? "[REQUEST RECEIVED — UI COMING NEXT]" : "[NO PENDING REQUEST]"}
      </div>
    </AppShell>
  );
}
