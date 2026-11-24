import { AppShell } from "@/layouts/app-shell";
import { AccountSelector } from "@/components/account-selector";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { ReceiveAddress } from "./receive-address";
import { ReceiveQrCard } from "./receive-qr-card";
import { ReceiveEmptyState } from "./receive-empty-state";

export default function ReceiveScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
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
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "var(--space-4)",
          padding: "var(--space-4)",
        }}
      >
        {identity ? (
          <>
            <AccountSelector
              wallet={wallet ?? null}
              activeIndex={activeIndex}
              accounts={accounts}
              identity={identity}
              onSelect={setActiveAccountIndex}
            />

            <div className="receive-qr-frame corner-frame">
              <ReceiveQrCard identity={identity} hideBalances={hideBalances} />
            </div>

            <ReceiveAddress identity={identity} />
          </>
        ) : (
          <ReceiveEmptyState />
        )}
      </div>
    </AppShell>
  );
}
