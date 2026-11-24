import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";
import { Identicon } from "@/components/identicon";
import { Input } from "@/components/input";
import { usePersistedStore, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { unlockWalletSession } from "@/lib/wallet";
import { recordAuditEvent } from "@/lib/audit-log";
import { Settings01Icon, ArrowRight01Icon, CheckmarkCircle01Icon } from "@/lib/icons";

export function ShellWalletSwitcher() {
  const navigate = useNavigate();
  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveWallet = usePersistedStore((s) => s.setActiveWallet);
  const touchWalletUnlocked = usePersistedStore((s) => s.touchWalletUnlocked);
  const unlock = useSessionStore((s) => s.unlock);

  const [open, setOpen] = useState(false);
  const [switchingWallet, setSwitchingWallet] = useState<WalletMeta | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === settings.activeWalletId) ?? wallets[0] ?? null,
    [settings.activeWalletId, wallets],
  );

  if (!activeWallet) return null;

  function close() {
    if (loading) return;
    setOpen(false);
    setSwitchingWallet(null);
    setPassword("");
    setError("");
  }

  function selectWallet(wallet: WalletMeta) {
    if (wallet.id === activeWallet.id) {
      close();
      return;
    }
    setSwitchingWallet(wallet);
    setPassword("");
    setError("");
  }

  async function confirmSwitch() {
    if (!switchingWallet) return;
    setLoading(true);
    setError("");
    try {
      const wallets = await unlockWalletSession(switchingWallet.encryptedData!, password);
      unlock(switchingWallet.id, wallets);
      setActiveWallet(switchingWallet.id);
      touchWalletUnlocked(switchingWallet.id);
      recordAuditEvent({
        kind: "unlock_succeeded",
        status: "success",
        title: "Wallet switched",
        detail: switchingWallet.name,
        walletId: switchingWallet.id,
      });
      close();
      navigate("/dashboard", { replace: true });
    } catch {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Wallet switch failed",
        detail: switchingWallet.name,
        walletId: switchingWallet.id,
      });
      setError("Wrong password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Switch wallet. Current wallet: ${activeWallet.name}`}
        onClick={() => setOpen(true)}
        className="glyph-avatar-btn corner-frame"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          padding: 0,
          borderRadius: "var(--radius-sharp)",
          boxShadow: "none",
          "--corner-size": "6px",
          "--corner-inset": "2px",
          cursor: "pointer",
        } as CSSProperties}
      >
        <Identicon kind="wallet" seed={`${activeWallet.id}:${activeWallet.color}`} label={activeWallet.name} size={32} radius={12} />
      </button>

      <Sheet
        open={open}
        onClose={close}
        title={switchingWallet ? `Unlock ${switchingWallet.name}` : "Wallets"}
        footer={
          switchingWallet ? (
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <Button variant="ghost" shape="sharp" onClick={() => setSwitchingWallet(null)} disabled={loading}>
                Back
              </Button>
              <Button onClick={confirmSwitch} loading={loading} disabled={!password.trim()}>
                Switch wallet
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { close(); navigate("/wallets"); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                width: "100%",
                padding: "var(--space-3)",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "var(--radius-control)",
                boxShadow: "var(--shadow-surface)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--color-text-secondary)",
              }}
            >
              <Settings01Icon size={18} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500 }}>
                Manage wallets
              </span>
              <ArrowRight01Icon size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            </button>
          )
        }
      >
        {switchingWallet ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <Identicon kind="wallet" seed={`${switchingWallet.id}:${switchingWallet.color}`} label={switchingWallet.name} size={40} radius={10} />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {switchingWallet.name}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                  Enter the wallet password to switch.
                </span>
              </div>
            </div>
            <Input
              label="Wallet password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && password.trim()) {
                  event.preventDefault();
                  void confirmSwitch();
                }
              }}
              error={error}
              autoFocus
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {wallets.map((wallet) => {
              const isActive = wallet.id === activeWallet.id;
              return (
                <button
                  key={wallet.id}
                  type="button"
                  onClick={() => selectWallet(wallet)}
                  aria-current={isActive ? "true" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    width: "100%",
                    padding: "var(--space-4)",
                    background: isActive ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
                    border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                    borderRadius: "var(--radius-control)",
                    boxShadow: isActive ? "var(--shadow-elevated)" : "var(--shadow-surface)",
                    cursor: isActive ? "default" : "pointer",
                    textAlign: "left",
                    color: "inherit",
                  }}
                >
                  <Identicon kind="wallet" seed={`${wallet.id}:${wallet.color}`} label={wallet.name} size={36} radius={10} />
                  <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {wallet.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
                      {isActive ? "Current wallet" : "Password required"}
                    </span>
                  </div>
                  {isActive ? <CheckmarkCircle01Icon size={18} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} /> : null}
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}
