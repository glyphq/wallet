import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckmarkCircle01Icon } from "@/lib/icons";
import { FramedAvatar } from "@/components/framed-avatar";
import { truncateId } from "@/lib/format";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

interface MenuPosition {
  left: number;
  top: number;
  width: number;
}

/** Header account avatar and switcher for the active wallet. */
export function ShellAccountSwitcher() {
  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveAccountIndex = usePersistedStore((s) => s.setActiveAccountIndex);
  const sessionAccounts = useSessionStore((s) => s.accounts);

  const wallet = useMemo(
    () => wallets.find((item) => item.id === settings.activeWalletId) ?? wallets[0] ?? null,
    [settings.activeWalletId, wallets],
  );
  const visibleAccounts = useMemo(
    () => wallet?.accounts.filter((account) => !account.hidden).sort((a, b) => a.index - b.index) ?? [],
    [wallet],
  );
  const identity = getWalletAccountIdentity(wallet, settings.activeAccountIndex, sessionAccounts);
  const activeAccount = wallet?.accounts.find((account) => account.index === settings.activeAccountIndex);
  const activeName = activeAccount?.name ?? `Account ${settings.activeAccountIndex + 1}`;

  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!wallet || !identity) return null;

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 220;
    setMenu({
      left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
      top: rect.bottom + 6,
      width,
    });
    setOpen(true);
  }

  function select(index: number) {
    setActiveAccountIndex(index);
    setOpen(false);
  }

  const menuNode = open && menu
    ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Choose account"
          style={{
            position: "fixed",
            left: menu.left,
            top: menu.top,
            width: menu.width,
            zIndex: 1000,
            padding: "var(--space-1)",
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-floating)",
          }}
        >
          {visibleAccounts.map((account) => {
            const accountIdentity = getWalletAccountIdentity(wallet, account.index, sessionAccounts);
            const isActive = account.index === settings.activeAccountIndex;
            return (
              <button
                key={account.index}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => select(account.index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  width: "100%",
                  padding: "var(--space-2) var(--space-3)",
                  border: 0,
                  borderRadius: "var(--radius-sharp)",
                  background: isActive ? "var(--color-bg-surface)" : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <FramedAvatar seed={accountIdentity ?? account.name} size={28} />
                <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {account.name}
                  </span>
                  {accountIdentity ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.04em" }}>
                      {truncateId(accountIdentity, 8, 8)}
                    </span>
                  ) : null}
                </span>
                {isActive ? (
                  <CheckmarkCircle01Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                ) : null}
              </button>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Switch account. Current account: ${activeName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          padding: 0,
          border: 0,
          background: "transparent",
          borderRadius: "var(--radius-sharp)",
          cursor: "pointer",
        }}
      >
        <FramedAvatar seed={identity} size={32} />
      </button>
      {menuNode}
    </>
  );
}
