import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { SettingsSwitch } from "@/components/settings-switch";
import { usePersistedStore } from "@/store/persisted";
import { unlockVault } from "@/lib/vault";
import { extractMessage } from "@/lib/format";
import { isWatchOnlyVault } from "@/lib/accounts";

const TIMEOUT_OPTIONS = [
  { label: "1m", value: 1 }, { label: "5m", value: 5 }, { label: "15m", value: 15 },
  { label: "30m", value: 30 }, { label: "1h", value: 60 }, { label: "Never", value: 0 },
];

const CLIPBOARD_OPTIONS = [
  { label: "15s", value: 15 }, { label: "30s", value: 30 },
  { label: "1m", value: 60 }, { label: "Never", value: 0 },
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
    try { await unlockVault(vault.encryptedData, enablePw); }
    catch { setEnableError("Wrong password"); setEnableLoading(false); return; }
    const pw = enablePw; setEnablePw("");
    try {
      await invoke("enable_biometric", { vaultId: vault.id, vaultData: vault.encryptedData, password: pw });
      updateSettings({ biometricVaultIds: [...biometricVaultIds, vault.id] });
      setEnabling(false);
    } catch (e) { setEnableError(`Secure storage failed: ${extractMessage(e)}`); }
    finally { setEnableLoading(false); }
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
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Security" />

        {/* Auto-lock */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <SettingsSectionLabel>Auto-lock timeout</SettingsSectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {TIMEOUT_OPTIONS.map((opt) => {
              const isActive = opt.value === autoLockMinutes;
              return (
                <motion.button
                  key={opt.value}
                  {...gesture.pressSubtle}
                  onClick={() => setLockTimeout(opt.value)}
                  style={{
                    position: "relative", padding: "var(--space-2) var(--space-4)",
                    borderRadius: "var(--radius-pill)", border: "none", cursor: "pointer",
                    background: "transparent",
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                    color: isActive ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="autoLock-pill"
                      style={{
                        position: "absolute", inset: 0,
                        background: "var(--color-accent)", borderRadius: "var(--radius-pill)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    />
                  )}
                  <span style={{ position: "relative", zIndex: 1 }}>{opt.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Lock toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSwitch label="Lock on sleep" description="Lock when the screen locks or machine sleeps" checked={lockOnSleep} onChange={() => updateSettings({ lockOnSleep: !lockOnSleep })} />
          <SettingsDivider />
          <SettingsSwitch label="Lock on window blur" description="Lock when the app loses focus" checked={lockOnWindowBlur} onChange={() => updateSettings({ lockOnWindowBlur: !lockOnWindowBlur })} />
        </div>

        {/* Divider */}
        <SettingsDivider />

        {/* Clipboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <SettingsSectionLabel>Clear clipboard after</SettingsSectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {CLIPBOARD_OPTIONS.map((opt) => {
              const isActive = opt.value === clipboardClearSeconds;
              return (
                <motion.button
                  key={opt.value}
                  {...gesture.pressSubtle}
                  onClick={() => updateSettings({ clipboardClearSeconds: opt.value })}
                  style={{
                    position: "relative", padding: "var(--space-2) var(--space-4)",
                    borderRadius: "var(--radius-pill)", border: "none", cursor: "pointer",
                    background: "transparent",
                    fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                    color: isActive ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="clipboard-pill"
                      style={{
                        position: "absolute", inset: 0,
                        background: "var(--color-accent)", borderRadius: "var(--radius-pill)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    />
                  )}
                  <span style={{ position: "relative", zIndex: 1 }}>{opt.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <SettingsDivider />

        {/* Approval toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <SettingsSwitch label="Password for burn" description="Require password before burning QU" checked={requirePasswordForBurn} onChange={() => updateSettings({ requirePasswordForBurn: !requirePasswordForBurn })} />
          <SettingsDivider />
          <SettingsSwitch label="Biometric for seed reveal" description={isLinux ? "Require quick unlock to view seed" : "Require biometric to view seed"} checked={requireBiometricForSeedReveal} onChange={() => updateSettings({ requireBiometricForSeedReveal: !requireBiometricForSeedReveal })} />
        </div>

        {/* Biometric setup — only card, only when relevant */}
        {!watchOnly && bioAvailable && vault && (
          <div style={{
            background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
            padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)",
          }}>
            <SettingsSectionLabel>{isLinux ? "Quick unlock" : "Biometric unlock"}</SettingsSectionLabel>
            {bioEnabled ? (
              <>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-success)" }}>
                  Enabled for {vault.name}
                </span>
                <Button variant="danger" onClick={handleDisable}>
                  Disable
                </Button>
              </>
            ) : enabling ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
                  Enter your password to enable
                </span>
                <Input
                  ref={pwRef} type="password" value={enablePw}
                  label="Password"
                  onChange={(e) => { setEnablePw(e.target.value); setEnableError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleEnable()}
                  placeholder="Password"
                  error={enableError || undefined}
                />
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button style={{ flex: 1 }} onClick={handleEnable} loading={enableLoading}>
                    {enableLoading ? "Verifying..." : "Enable"}
                  </Button>
                  <Button variant="secondary" style={{ width: "auto" }} onClick={() => { setEnabling(false); setEnablePw(""); setEnableError(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setEnabling(true)}>
                Enable for {vault.name}
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
