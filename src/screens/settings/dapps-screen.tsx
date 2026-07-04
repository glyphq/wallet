import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { formatDate } from "@/lib/format";

const PERMISSION_LABELS: Record<string, string> = {
  transfer: "Transfer",
  sc_call: "Contract calls",
  sign_message: "Sign messages",
};

export default function DappsScreen() {
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const revokeDapp = usePersistedStore((s) => s.revokeDapp);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", paddingBottom: "calc(var(--space-4) + 76px)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Approved dApps" />

        {approvedDapps.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "var(--space-8) 0",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
            color: "var(--color-text-disabled)",
          }}>
            No approved dApps
          </div>
        ) : (
          <div style={{
            background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", overflow: "hidden",
          }}>
            {approvedDapps.map((dapp, i) => (
              <div key={dapp.origin} style={{
                padding: "var(--space-3) var(--space-4)",
                borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {dapp.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: 2, wordBreak: "break-all" }}>
                      {dapp.origin}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeDapp(dapp.origin)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                      fontWeight: 500, color: "var(--color-status-error)", padding: 0, flexShrink: 0,
                    }}
                  >
                    Revoke
                  </button>
                </div>
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
                    {formatDate(dapp.approvedAt)}
                  </span>
                  {dapp.permissions.length > 0 && (
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                      {dapp.permissions.map((p) => PERMISSION_LABELS[p] ?? p).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
