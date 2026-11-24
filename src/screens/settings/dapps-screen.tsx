import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { truncateId } from "@/lib/format";
import { DappListItem } from "./dapps/dapp-list-item";

export default function DappsScreen() {
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);
  const wallets = usePersistedStore((s) => s.wallets);
  const revokeDapp = usePersistedStore((s) => s.revokeDapp);
  const revokeDappPermission = usePersistedStore((s) => s.revokeDappPermission);
  const setDappAllowedIdentities = usePersistedStore((s) => s.setDappAllowedIdentities);
  const setDappPolicy = usePersistedStore((s) => s.setDappPolicy);

  const sortedDapps = approvedDapps
    .slice()
    .sort((a, b) => (b.lastUsedAt ?? b.approvedAt) - (a.lastUsedAt ?? a.approvedAt));

  function getIdentityLabel(identity: string) {
    for (const wallet of wallets) {
      const account = wallet.accounts.find((candidate) => candidate.identity === identity);
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
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Approved dApps" />

        {sortedDapps.length === 0 ? (
          <div style={{
            padding: "var(--space-8) 0",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-body)",
            color: "var(--color-text-secondary)",
          }}>
            No approved dApps
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {sortedDapps.map((dapp, index) => (
              <DappListItem
                key={dapp.origin}
                dapp={dapp}
                divided={index > 0}
                identityLabel={getIdentityLabel}
                onRemoveIdentity={(identity) => revokeIdentityScope(dapp.origin, identity, dapp.allowedIdentities)}
                onRemovePermission={(permission) => revokeDappPermission(dapp.origin, permission)}
                onPolicyChange={(policy) => setDappPolicy(dapp.origin, policy)}
                onRevoke={() => revokeDapp(dapp.origin)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
