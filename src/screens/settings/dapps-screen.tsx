import { motion } from "framer-motion";

import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";

const PERMISSION_LABELS: Record<string, string> = {
  transfer: "Transfer",
  sc_call: "Contract calls",
  sign_message: "Sign messages",
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DappsScreen() {
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const revokeDapp = usePersistedStore((s) => s.revokeDapp);

  return (
    <AppShell
      fullBleed
      contentStyle={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <motion.div
        initial={{ y: 4 }}
        animate={{ y: 0 }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
      >
        <SettingsPageHeader title="Approved dApps" />

        {approvedDapps.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--color-text-disabled)",
              textAlign: "center",
            }}
          >
            No approved dApps
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            {approvedDapps.map((dapp, i) => (
              <>
                {i > 0 && <div style={{ height: 1, background: "var(--color-border-subtle)" }} />}
                <div
                  key={dapp.origin}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) 0",
                  }}
                >
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {dapp.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-label)",
                      color: "var(--color-text-disabled)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    {dapp.origin}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-small)",
                      color: "var(--color-text-disabled)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    Approved {formatDate(dapp.approvedAt)}
                  </div>
                </div>

                {dapp.permissions.length > 0 && (
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-small)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {dapp.permissions.map((p) => PERMISSION_LABELS[p] ?? p).join(", ")}
                  </div>
                )}

                <button
                  onClick={() => revokeDapp(dapp.origin)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                    color: "var(--color-status-error)",
                    padding: 0,
                    textAlign: "left",
                  }}
                >
                  Revoke
                </button>
                </div>
              </>
            ))}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
