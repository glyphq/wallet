import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { formatDate, truncateId } from "@/lib/format";

const PERMISSION_LABELS: Record<string, string> = {
  transfer: "Transfer",
  sc_call: "Contract calls",
  sign_message: "Sign messages",
};

export default function DappsScreen() {
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const vaults = usePersistedStore((s) => s.vaults);
  const revokeDapp = usePersistedStore((s) => s.revokeDapp);
  const revokeDappPermission = usePersistedStore((s) => s.revokeDappPermission);
  const setDappAllowedIdentities = usePersistedStore((s) => s.setDappAllowedIdentities);

  const sortedDapps = approvedDapps
    .slice()
    .sort((a, b) => (b.lastUsedAt ?? b.approvedAt) - (a.lastUsedAt ?? a.approvedAt));

  function getIdentityLabel(identity: string) {
    for (const vault of vaults) {
      const account = vault.accounts.find((candidate) => candidate.identity === identity);
      if (account) return `${account.name} · ${truncateId(identity, 8, 4)}`;
    }
    return truncateId(identity, 8, 4);
  }

  function revokeIdentityScope(origin: string, identity: string, allowedIdentities: string[] | undefined) {
    if (!allowedIdentities) {
      revokeDapp(origin);
      return;
    }

    const next = allowedIdentities.filter((candidate) => candidate !== identity);
    if (next.length === 0) revokeDapp(origin);
    else setDappAllowedIdentities(origin, next);
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Approved dApps" />

        {sortedDapps.length === 0 ? (
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
            {sortedDapps.map((dapp, i) => (
              <div key={dapp.origin} style={{
                padding: "var(--space-4)",
                borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
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
                    type="button"
                    onClick={() => revokeDapp(dapp.origin)}
                    style={{
                      minHeight: 44,
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                      fontWeight: 500, color: "var(--color-status-error)", padding: 0, flexShrink: 0,
                    }}
                  >
                    Revoke
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
                    Approved {formatDate(dapp.approvedAt)}
                  </span>
                  {dapp.lastUsedAt && (
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                      Last used {formatDate(dapp.lastUsedAt)}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-text-disabled)" }}>
                    Shared accounts
                  </div>
                  {dapp.allowedIdentities && dapp.allowedIdentities.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                      {dapp.allowedIdentities.map((identity) => (
                        <div key={identity} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                            {getIdentityLabel(identity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => revokeIdentityScope(dapp.origin, identity, dapp.allowedIdentities)}
                            style={{
                              minHeight: 40,
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--color-status-error)",
                              fontFamily: "var(--font-sans)",
                              fontSize: "var(--text-label)",
                              fontWeight: 500,
                              padding: 0,
                              flexShrink: 0,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                      All accounts in this wallet
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-text-disabled)" }}>
                    Permissions
                  </div>
                  {dapp.permissions.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      {dapp.permissions.map((permission) => (
                        <button
                          key={permission}
                          type="button"
                          onClick={() => revokeDappPermission(dapp.origin, permission)}
                          style={{
                            minHeight: 40,
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            padding: "0 var(--space-3)",
                            background: "var(--color-bg-base)",
                            border: "1px solid var(--color-border-subtle)",
                            borderRadius: "var(--radius-pill)",
                            color: "var(--color-text-secondary)",
                            cursor: "pointer",
                            fontFamily: "var(--font-sans)",
                            fontSize: "var(--text-label)",
                            fontWeight: 500,
                          }}
                        >
                          <span>{PERMISSION_LABELS[permission] ?? permission}</span>
                          <span aria-hidden="true" style={{ color: "var(--color-status-error)" }}>×</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                      No extra permissions granted
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
