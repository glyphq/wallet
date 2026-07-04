import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { unlockVault } from "@/lib/vault";
import { extractMessage } from "@/lib/format";
import { isWatchOnlyVault } from "@/lib/accounts";

const TIMEOUT_OPTIONS = [
  { label: "1m", value: 1 },
  { label: "5m", value: 5 },
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "Never", value: 0 },
];

const CLIPBOARD_OPTIONS = [
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "Never", value: 0 },
];

export default function SecurityScreen() {
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");

  const settings = usePersistedStore((s) => s.settings);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const vaults = usePersistedStore((s) => s.vaults);

  const { autoLockMinutes, lockOnWindowBlur, lockOnSleep, clipboardClearSeconds,
    requirePasswordForBurn, requireBiometricForSeedReveal } = settings;
  const biometricVaultIds = settings.biometricVaultIds ?? [];
  const vault = vaults.find((v) => v.id === settings.activeVaultId) ?? vaults[0];
  const watchOnly = isWatchOnlyVault(vault);
  const bioEnabled = vault ? biometricVaultIds.includes(vault.id) : false;

  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [enablePw, setEnablePw] = useState("");
  const [enableError, setEnableError] = useState("");
  const [enableLoading, setEnableLoading] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    invoke<boolean>("check_biometric_available").then(setBioAvailable).catch(() => setBioAvailable(false));
  }, []);

  useEffect(() => {
    if (enabling) requestAnimationFrame(() => pwRef.current?.focus());
  }, [enabling]);

  async function handleEnable() {
    if (!vault) return;
    setEnableLoading(true); setEnableError("");
    if (!vault.encryptedData) { setEnableError("Vault data missing"); setEnableLoading(false); return; }
    try {
      await unlockVault(vault.encryptedData, enablePw);
    } catch {
      setEnableError("Wrong password"); setEnableLoading(false); return;
    }
    const pw = enablePw;
    setEnablePw("");
    try {
      await invoke("enable_biometric", { vaultId: vault.id, vaultData: vault.encryptedData, password: pw });
      updateSettings({ biometricVaultIds: [...biometricVaultIds, vault.id] });
      setEnabling(false);
    } catch (e) {
      setEnableError(`Secure storage failed: ${extractMessage(e)}`);
    } finally {
      setEnableLoading(false);
    }
  }

  async function handleDisable() {
    if (!vault) return;
    try { await invoke("disable_biometric", { vaultId: vault.id }); } catch { /* ok */ }
    updateSettings({ biometricVaultIds: biometricVaultIds.filter((id) => id !== vault.id) });
  }

  function setLockTimeout(minutes: number) {
    updateSettings({ autoLockMinutes: minutes });
    invoke("set_lock_timeout", { minutes }).catch(() => {});
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", paddingBottom: "calc(var(--space-4) + 76px)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Security" />

        {/* Lock */}
        <Card>
          <CardHeader>Lock</CardHeader>
          <PillGroup options={TIMEOUT_OPTIONS} selected={autoLockMinutes} onSelect={setLockTimeout} label="Auto-lock timeout" />
          <Toggle label="Lock on sleep" description="Lock when the screen locks or machine sleeps" enabled={lockOnSleep} onToggle={() => updateSettings({ lockOnSleep: !lockOnSleep })} />
          <Toggle label="Lock on window blur" description="Lock when the app loses focus" enabled={lockOnWindowBlur} onToggle={() => updateSettings({ lockOnWindowBlur: !lockOnWindowBlur })} />
        </Card>

        {/* Clipboard */}
        <Card>
          <CardHeader>Clipboard</CardHeader>
          <PillGroup options={CLIPBOARD_OPTIONS} selected={clipboardClearSeconds} onSelect={(v) => updateSettings({ clipboardClearSeconds: v })} label="Clear copied addresses after" />
        </Card>

        {/* Approval */}
        <Card>
          <CardHeader>Approval</CardHeader>
          <Toggle label="Password for burn" description="Require password before burning QU" enabled={requirePasswordForBurn} onToggle={() => updateSettings({ requirePasswordForBurn: !requirePasswordForBurn })} />
          <Toggle label="Biometric for seed reveal" description={isLinux ? "Require quick unlock to view seed" : "Require biometric to view seed"} enabled={requireBiometricForSeedReveal} onToggle={() => updateSettings({ requireBiometricForSeedReveal: !requireBiometricForSeedReveal })} />
        </Card>

        {/* Biometric */}
        {!watchOnly && bioAvailable && vault && (
          <Card>
            <CardHeader>{isLinux ? "Quick unlock" : "Biometric unlock"}</CardHeader>
            {bioEnabled ? (
              <>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-success)" }}>
                  Enabled for {vault.name}
                </span>
                <motion.button
                  {...gesture.pressSubtle}
                  onClick={handleDisable}
                  style={{
                    padding: "var(--space-3)", background: "transparent",
                    border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                    cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                    fontWeight: 500, color: "var(--color-status-error)", width: "100%",
                  }}
                >
                  Disable
                </motion.button>
              </>
            ) : enabling ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                  Enter your password to enable
                </span>
                <input
                  ref={pwRef}
                  type="password"
                  value={enablePw}
                  onChange={(e) => { setEnablePw(e.target.value); setEnableError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleEnable()}
                  placeholder="Password"
                  style={{
                    background: "transparent", border: "none",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    padding: "var(--space-2) 0", fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-body)", color: "var(--color-text-display)", outline: "none",
                  }}
                />
                {enableError && (
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
                    {enableError}
                  </span>
                )}
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <motion.button
                    {...gesture.press}
                    onClick={handleEnable}
                    disabled={enableLoading}
                    style={{
                      flex: 1, padding: "var(--space-3)", background: "var(--color-accent)",
                      border: "none", borderRadius: "var(--radius-sharp)", cursor: "pointer",
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                      color: "var(--color-bg-base)", opacity: enableLoading ? 0.6 : 1,
                    }}
                  >
                    {enableLoading ? "Verifying..." : "Enable"}
                  </motion.button>
                  <button
                    onClick={() => { setEnabling(false); setEnablePw(""); setEnableError(""); }}
                    style={{
                      padding: "var(--space-3) var(--space-4)", background: "transparent",
                      border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                      cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                      fontWeight: 500, color: "var(--color-text-secondary)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <motion.button
                {...gesture.pressSubtle}
                onClick={() => setEnabling(true)}
                style={{
                  padding: "var(--space-3)", background: "transparent",
                  border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                  cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                  fontWeight: 500, color: "var(--color-accent)", width: "100%",
                }}
              >
                Enable for {vault.name}
              </motion.button>
            )}
          </Card>
        )}
      </motion.div>
    </AppShell>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "var(--space-3)",
      background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
      padding: "var(--space-4)",
    }}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
      fontWeight: 600, color: "var(--color-text-disabled)",
      textTransform: "uppercase" as const, letterSpacing: "0.06em",
    }}>
      {children}
    </span>
  );
}

function Toggle({ label, description, enabled, onToggle }: {
  label: string; description: string; enabled: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "var(--space-2) 0", width: "100%", background: "none",
        border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>
          {description}
        </div>
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: "var(--radius-pill)", flexShrink: 0, position: "relative",
        background: enabled ? "var(--color-accent)" : "var(--color-border-strong)",
        transition: "background 0.15s ease",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%",
          background: enabled ? "var(--color-bg-base)" : "var(--color-text-disabled)",
          position: "absolute", top: 2, left: enabled ? 18 : 2, transition: "left 0.15s ease",
        }} />
      </div>
    </button>
  );
}

function PillGroup({ options, selected, onSelect, label }: {
  options: { label: string; value: number }[];
  selected: number;
  onSelect: (v: number) => void;
  label: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {options.map((opt) => {
          const active = opt.value === selected;
          return (
            <motion.button
              key={opt.value}
              {...gesture.pressSubtle}
              onClick={() => onSelect(opt.value)}
              style={{
                padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-pill)",
                border: "none", cursor: "pointer",
                background: active ? "var(--color-accent)" : "var(--color-bg-elevated)",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                color: active ? "var(--color-bg-base)" : "var(--color-text-secondary)",
              }}
            >
              {opt.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
