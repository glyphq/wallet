import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/button";
import { Identicon } from "@/components/identicon";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type VaultMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";
import { unlockSecureSession } from "@/lib/secure-session";
import { unlockVault } from "@/lib/vault";
import { isWatchOnlyVault } from "@/lib/accounts";
import { recordAuditEvent } from "@/lib/audit-log";

export function ShellVaultSwitcher() {
  const navigate = useNavigate();
  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveVault = usePersistedStore((s) => s.setActiveVault);
  const touchVaultUnlocked = usePersistedStore((s) => s.touchVaultUnlocked);
  const unlock = useSessionStore((s) => s.unlock);

  const [open, setOpen] = useState(false);
  const [switchingVault, setSwitchingVault] = useState<VaultMeta | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeVault = useMemo(
    () => vaults.find((vault) => vault.id === settings.activeVaultId) ?? vaults[0] ?? null,
    [settings.activeVaultId, vaults],
  );

  if (!activeVault) return null;

  function close() {
    if (loading) return;
    setOpen(false);
    setSwitchingVault(null);
    setPassword("");
    setError("");
  }

  function activateWatchOnlyVault(vault: VaultMeta) {
    unlock(vault.id, [], {
      watchOnly: true,
      identities: vault.accounts.map((account) => account.identity).filter((identity): identity is string => !!identity),
    });
    setActiveVault(vault.id);
    touchVaultUnlocked(vault.id);
    recordAuditEvent({
      kind: "unlock_succeeded",
      status: "success",
      title: "Wallet switched",
      detail: vault.name,
      vaultId: vault.id,
    });
    close();
    navigate("/dashboard", { replace: true });
  }

  function selectVault(vault: VaultMeta) {
    if (vault.id === activeVault.id) {
      close();
      return;
    }
    if (isWatchOnlyVault(vault)) {
      activateWatchOnlyVault(vault);
      return;
    }
    setSwitchingVault(vault);
    setPassword("");
    setError("");
  }

  async function confirmSwitch() {
    if (!switchingVault) return;
    setLoading(true);
    setError("");
    try {
      const seeds = await unlockVault(switchingVault.encryptedData!, password);
      const wallets = await unlockSecureSession(seeds);
      unlock(switchingVault.id, wallets);
      setActiveVault(switchingVault.id);
      touchVaultUnlocked(switchingVault.id);
      recordAuditEvent({
        kind: "unlock_succeeded",
        status: "success",
        title: "Wallet switched",
        detail: switchingVault.name,
        vaultId: switchingVault.id,
      });
      close();
      navigate("/dashboard", { replace: true });
    } catch {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Wallet switch failed",
        detail: switchingVault.name,
        vaultId: switchingVault.id,
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
        aria-label={`Switch wallet. Current wallet: ${activeVault.name}`}
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          padding: 0,
          background: "transparent",
          border: "none",
          borderRadius: "var(--radius-control)",
          cursor: "pointer",
        }}
      >
        <Identicon kind="vault" seed={`${activeVault.id}:${activeVault.color}`} label={activeVault.name} size={32} radius={10} walletIcon={activeVault.icon} vaultColor={activeVault.color} />
      </button>

      <Sheet
        open={open}
        onClose={close}
        title={switchingVault ? `Unlock ${switchingVault.name}` : "Switch wallet"}
        footer={
          switchingVault ? (
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <Button variant="ghost" shape="sharp" onClick={() => setSwitchingVault(null)} disabled={loading}>
                Back
              </Button>
              <Button onClick={confirmSwitch} loading={loading} disabled={!password.trim()}>
                Switch wallet
              </Button>
            </div>
          ) : undefined
        }
      >
        {switchingVault ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <Identicon kind="vault" seed={`${switchingVault.id}:${switchingVault.color}`} label={switchingVault.name} size={40} radius={10} walletIcon={switchingVault.icon} vaultColor={switchingVault.color} />
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {switchingVault.name}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {vaults.map((vault) => {
              const isActive = vault.id === activeVault.id;
              return (
                <button
                  key={vault.id}
                  type="button"
                  onClick={() => selectVault(vault)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    width: "100%",
                    padding: "var(--space-3) 0",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    cursor: isActive ? "default" : "pointer",
                    textAlign: "left",
                    color: "inherit",
                  }}
                >
                  <Identicon kind="vault" seed={`${vault.id}:${vault.color}`} label={vault.name} size={36} radius={10} walletIcon={vault.icon} vaultColor={vault.color} />
                  <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {vault.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                      {isActive ? "Current wallet" : isWatchOnlyVault(vault) ? "Watch-only" : "Password required"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </>
  );
}
