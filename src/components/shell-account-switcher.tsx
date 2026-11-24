import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { FramedAvatar } from "@/components/framed-avatar";
import { Button } from "@/components/button";
import { AsciiPageHeader } from "@/components/ascii-page-header";
import { Settings01Icon } from "@/lib/icons";
import { truncateId } from "@/lib/format";
import { getWalletAccountIdentity } from "@/lib/accounts";
import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

interface AccountMenu {
  left: number;
  top: number;
  width: number;
  height: number;
  originLeft: number;
  originTop: number;
  originWidth: number;
  originHeight: number;
}

/** Header account avatar and fullscreen account switcher. */
export function ShellAccountSwitcher() {
  const navigate = useNavigate();
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
  const [menu, setMenu] = useState<AccountMenu | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!wallet || !identity) return null;

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const titlebarHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--height-titlebar"),
    ) || 0;
    setMenu({
      left: 0,
      top: titlebarHeight,
      width: window.innerWidth,
      height: window.innerHeight - titlebarHeight,
      originLeft: rect.left,
      originTop: rect.top,
      originWidth: rect.width,
      originHeight: rect.height,
    });
    setOpen(true);
  }

  function select(index: number) {
    setActiveAccountIndex(index);
    setOpen(false);
  }

  const overlay = menu
    ? createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              key="accounts"
              role="dialog"
              aria-modal="true"
              aria-label="Accounts"
              initial={{
                left: menu.originLeft,
                top: menu.originTop,
                width: menu.originWidth,
                height: menu.originHeight,
                borderRadius: 8,
                opacity: 0.85,
              }}
              animate={{
                left: menu.left,
                top: menu.top,
                width: menu.width,
                height: menu.height,
                borderRadius: 0,
                opacity: 1,
              }}
              exit={{
                left: menu.originLeft,
                top: menu.originTop,
                width: menu.originWidth,
                height: menu.originHeight,
                borderRadius: 8,
                opacity: 0,
              }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              style={{
                position: "fixed",
                zIndex: 1001,
                overflow: "hidden",
                background: "var(--color-bg-base)",
                display: "flex",
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.18 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column" }}
              >
                <AsciiPageHeader>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-section)", lineHeight: "var(--leading-tight)", fontWeight: 400, letterSpacing: "0.04em", color: "var(--color-text-primary)" }}>
                    Accounts
                  </span>
                </AsciiPageHeader>

                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    minHeight: 0,
                    width: "100%",
                    maxWidth: 720,
                    flexDirection: "column",
                    margin: "0 auto",
                    padding: "var(--space-3) var(--screen-padding) 0",
                  }}
                >
                  <div role="listbox" aria-label="Choose account" style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", gap: "var(--space-2)", overflowY: "auto" }}>
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
                          className={isActive ? "corner-frame" : undefined}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-3)",
                            width: "100%",
                            minHeight: 64,
                            padding: "var(--space-3)",
                            border: 0,
                            borderRadius: "var(--radius-sharp)",
                            background: isActive ? "var(--color-bg-surface)" : "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            textAlign: "left",
                            "--corner-color": "var(--color-accent)",
                            "--corner-size": "10px",
                            "--corner-inset": "3px",
                          } as CSSProperties}
                        >
                          <FramedAvatar seed={accountIdentity ?? account.name} size={34} />
                          <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                              {account.name}
                            </span>
                            {accountIdentity ? (
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)", letterSpacing: "0.04em" }}>
                                {truncateId(accountIdentity, 8, 8)}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ flexShrink: 0, width: "100%", marginTop: "var(--space-3)", padding: "var(--space-3) var(--screen-padding)", borderTop: "1px solid var(--color-border-subtle)" }}>
                  <div style={{ display: "flex", width: "100%", maxWidth: 720, flexDirection: "column", gap: "var(--space-2)", margin: "0 auto" }}>
                    <Button
                      variant="secondary"
                      size="md"
                      style={{ width: "100%" }}
                      onClick={() => {
                        setOpen(false);
                        navigate("/accounts");
                      }}
                    >
                      <Settings01Icon size={15} strokeWidth={1.5} aria-hidden="true" />
                      Manage accounts
                    </Button>
                    <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => setOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Switch account. Current account: ${activeName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          padding: 0,
          lineHeight: 0,
          border: 0,
          background: "transparent",
          borderRadius: "var(--radius-sharp)",
          cursor: "pointer",
        }}
      >
        <FramedAvatar seed={identity} size={32} />
      </button>
      {overlay}
    </>
  );
}
