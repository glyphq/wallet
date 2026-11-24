import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { DappRow } from "./dapps/dapp-row";

export default function DappsScreen() {
  const navigate = useNavigate();
  const approvedDapps = usePersistedStore((s) => s.settings.approvedDapps);

  const sortedDapps = approvedDapps
    .slice()
    .sort((a, b) => b.approvedAt - a.approvedAt);

  function detailPath(origin: string) {
    return `/settings/dapps/detail?origin=${encodeURIComponent(origin)}`;
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
          <div className="dapps-list" aria-label="Approved dApps">
            {sortedDapps.map((dapp) => (
              <DappRow key={dapp.origin} dapp={dapp} onOpen={() => navigate(detailPath(dapp.origin))} />
            ))}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
