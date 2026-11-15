import { useMemo } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { Link01Icon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { IconButton } from "@/components/icon-button";
import { ShellVaultSwitcher } from "@/components/shell-vault-switcher";
import { IdentityDisplay } from "@/components/identity-display";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getVaultAccountIdentity } from "@/lib/accounts";
import { ReceiveQrCard } from "./receive-qr-card";
import { ReceiveEmptyState } from "./receive-empty-state";

export default function ReceiveScreen() {
  const navigate = useNavigate();

  const settings = usePersistedStore((s) => s.settings);
  const vault = usePersistedStore((s) => s.vaults.find((v) => v.id === s.settings.activeVaultId));
  const wallets = useSessionStore((s) => s.wallets);

  const activeIndex = settings.activeAccountIndex;
  const identity = getVaultAccountIdentity(vault ?? null, activeIndex, wallets);
  const hideBalances = settings.hideBalances;

  const header = useMemo(() => (
    <ScreenHeader
      leading={<ShellVaultSwitcher />}
      title="Receive"
      action={
        <IconButton label="Create payment link" onClick={() => navigate("/payment-link")}>
          <Link01Icon size={20} aria-hidden="true" />
        </IconButton>
      }
    />
  ), [navigate]);

  return (
    <AppShell
      fullBleed
      statusBar={header}
      contentStyle={{ padding: "var(--space-4)", height: "100%" }}
    >
      <motion.div
        {...stepMotion}
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "var(--space-5)" }}
      >
        <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "var(--space-5)" }}>
          {identity ? (
            <>
              <ReceiveQrCard identity={identity} hideBalances={hideBalances} />
              <IdentityDisplay identity={identity} style={{ textAlign: "center", maxWidth: 300 }} />
            </>
          ) : (
            <ReceiveEmptyState />
          )}
        </div>
      </motion.div>
    </AppShell>
  );
}
