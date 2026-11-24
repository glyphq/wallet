import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Identicon } from "@/components/identicon";
import { Input } from "@/components/input";
import { ArrowLeft01Icon, CheckmarkCircle01Icon, ChevronRight01Icon } from "@/lib/icons";
import { stepMotion } from "@/lib/animations";
import { recordAuditEvent } from "@/lib/audit-log";
import { unlockWalletSession } from "@/lib/wallet";
import { usePersistedStore, type WalletMeta } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

export default function SwitchWalletScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const wallets = usePersistedStore((s) => s.wallets);
  const settings = usePersistedStore((s) => s.settings);
  const setActiveWallet = usePersistedStore((s) => s.setActiveWallet);
  const touchWalletUnlocked = usePersistedStore((s) => s.touchWalletUnlocked);
  const unlock = useSessionStore((s) => s.unlock);

  const activeWallet = wallets.find((wallet) => wallet.id === settings.activeWalletId) ?? wallets[0] ?? null;
  const orderedWallets = wallets.slice().sort((a, b) => (b.lastUnlockedAt ?? 0) - (a.lastUnlockedAt ?? 0));
  const requestedId = searchParams.get("wallet");

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const target = requestedId ? wallets.find((wallet) => wallet.id === requestedId) ?? null : null;

  function chooseWallet(wallet: WalletMeta) {
    if (wallet.id === activeWallet?.id) {
      navigate(-1);
      return;
    }
    setSearchParams({ wallet: wallet.id });
    setPassword("");
    setError("");
  }

  function backToList() {
    if (loading) return;
    setSearchParams({}, { replace: true });
    setPassword("");
    setError("");
  }

  async function confirmSwitch() {
    if (!target || loading) return;
    if (!target.encryptedData) {
      setError("Wallet data is missing. Re-import the wallet and try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const accounts = await unlockWalletSession(target.encryptedData, password);
      unlock(target.id, accounts);
      setActiveWallet(target.id);
      touchWalletUnlocked(target.id);
      recordAuditEvent({
        kind: "unlock_succeeded",
        status: "success",
        title: "Wallet switched",
        detail: target.name,
        walletId: target.id,
      });
      navigate("/dashboard", { replace: true });
    } catch {
      recordAuditEvent({
        kind: "unlock_failed",
        status: "failure",
        title: "Wallet switch failed",
        detail: target.name,
        walletId: target.id,
      });
      setError("Wrong password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column" }}>
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={target ? target.id : "wallets"}
            {...stepMotion}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            {target ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Identicon kind="wallet" seed={`${target.id}:${target.color}`} label={target.name} size={48} />
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-title)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {target.name}
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

                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <Button variant="ghost" onClick={backToList} disabled={loading}>
                    <ArrowLeft01Icon size={18} aria-hidden="true" />
                    Back
                  </Button>
                  <Button onClick={() => void confirmSwitch()} loading={loading} disabled={!password.trim()}>
                    Switch wallet
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
                  Choose a wallet
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {orderedWallets.map((wallet) => {
                    const isActive = wallet.id === activeWallet?.id;
                    return (
                      <button
                        key={wallet.id}
                        type="button"
                        onClick={() => chooseWallet(wallet)}
                        aria-current={isActive ? "true" : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-3)",
                          width: "100%",
                          padding: "var(--space-3)",
                          background: isActive ? "var(--color-bg-elevated)" : "var(--color-bg-surface)",
                          border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-border-subtle)"}`,
                          borderRadius: "var(--radius-control)",
                          boxShadow: isActive ? "var(--shadow-elevated)" : "var(--shadow-surface)",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "inherit",
                        }}
                      >
                        <Identicon kind="wallet" seed={`${wallet.id}:${wallet.color}`} label={wallet.name} size={36} />
                        <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                            {wallet.name}
                          </span>
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
                            {isActive ? "Current wallet" : "Password required"}
                          </span>
                        </span>
                        {isActive ? (
                          <CheckmarkCircle01Icon size={18} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                        ) : (
                          <ChevronRight01Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <Button variant="secondary" onClick={() => navigate("/wallets")}>
                  Manage wallets
                </Button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
