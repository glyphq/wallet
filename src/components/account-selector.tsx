import { useEffect, useRef, useState } from "react";
import { ArrowDown01Icon } from "@/lib/icons";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { truncateId } from "@/lib/format";
import { getWalletAccountIdentity } from "@/lib/accounts";

type Wallet = NonNullable<ReturnType<typeof usePersistedStore.getState>["wallets"][number]>;
type SessionAccounts = ReturnType<typeof useSessionStore.getState>["accounts"];

export function AccountSelector({ wallet, activeIndex, accounts, identity, onSelect }: {
  wallet: Wallet | null;
  activeIndex: number;
  accounts: SessionAccounts;
  identity: string | null;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visibleAccounts =
    wallet?.accounts.filter((a) => !a.hidden).sort((a, b) => a.index - b.index) ?? [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!identity) {
    return (
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
        No account
      </span>
    );
  }

  const accountName = wallet?.accounts[activeIndex]?.name ?? `Account ${activeIndex + 1}`;

  if (visibleAccounts.length <= 1) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.02em" }}>
          {accountName}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{ display: "flex", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)", letterSpacing: "0.02em" }}>
          {accountName}
        </span>
        <ArrowDown01Icon
          size={12}
          strokeWidth={1.5}
          style={{ color: "var(--color-text-disabled)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + var(--space-2))", left: 0, zIndex: 100,
            minWidth: 200, background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-card)", padding: "var(--space-1)", boxShadow: "var(--shadow-floating)",
          }}
        >
          {visibleAccounts.map((account) => {
            const isActive = account.index === activeIndex;
            const accIdentity = getWalletAccountIdentity(wallet, account.index, accounts);
            return (
              <button
                key={account.index}
                onClick={() => { onSelect(account.index); setOpen(false); }}
                style={{
                  display: "flex", flexDirection: "column", gap: 2, width: "100%",
                  padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sharp)", border: "none",
                  background: isActive ? "var(--color-bg-surface)" : "transparent",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {account.name}
                </span>
                {accIdentity && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                    {truncateId(accIdentity)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
