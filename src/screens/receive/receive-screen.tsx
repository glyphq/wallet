import { AppShell } from "@/layouts/app-shell";
import { IdentityDisplay } from "@/components/identity-display";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { ReceiveQrCard } from "./receive-qr-card";
import { ReceiveEmptyState } from "./receive-empty-state";

export default function ReceiveScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const wallet = usePersistedStore((s) => s.wallets.find((v) => v.id === s.settings.activeWalletId));
  const accounts = useSessionStore((s) => s.accounts);

  const activeIndex = settings.activeAccountIndex;
  const identity = getWalletAccountIdentity(wallet ?? null, activeIndex, accounts);
  const hideBalances = settings.hideBalances;

  return (
    <AppShell fullBleed>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "var(--space-5)",
          padding: "var(--space-6) var(--space-4)",
        }}
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
