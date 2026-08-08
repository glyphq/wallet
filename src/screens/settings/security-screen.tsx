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

const TIMEOUT_OPTIONS = [
  { label: "1m", value: 1 }, { label: "5m", value: 5 }, { label: "15m", value: 15 },
  { label: "30m", value: 30 }, { label: "1h", value: 60 },
];

const CLIPBOARD_OPTIONS = [
  { label: "15s", value: 15 }, { label: "30s", value: 30 },
  { label: "1m", value: 60 }, { label: "Never", value: 0 },
];

const optionGroupStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-2)",
} as const;

const sectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
} as const;

function ChoiceButton({
  active,
  children,
  onClick,
  ariaLabel,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <motion.button
      {...gesture.pressSubtle}
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      onClick={onClick}
      style={{
        minHeight: 36,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-control)",
        border: "1px solid var(--color-border-subtle)",
        cursor: "pointer",
        background: active ? "var(--color-bg-elevated)" : "transparent",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label)",
        fontWeight: active ? 650 : 500,
        color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      }}
    >
      {children}
    </motion.button>
  );
}

export default function SecurityScreen() {
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");
  const settings = usePersistedStore((s) => s.settings);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const vaults = usePersistedStore((s) => s.vaults);

  const { autoLockMinutes, lockOnWindowBlur, lockOnSleep, clipboardClearSeconds,
    requirePasswordForBurn, requireBiometricForSeedReveal } = settings;
  const biometricVaultIds = settings.biometricVaultIds ?? [];
  const vault = vaults.find((v) => v.id === settings.activeVaultId) ?? vaults[0];
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
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Security" />

        <section style={sectionStyle} aria-label="Auto-lock timeout">
          <SettingsSectionLabel>Auto-lock timeout</SettingsSectionLabel>
          <div style={optionGroupStyle}>
            {TIMEOUT_OPTIONS.map((opt) => (
              <ChoiceButton
                key={opt.value}
                active={opt.value === autoLockMinutes}
                onClick={() => setLockTimeout(opt.value)}
                ariaLabel={`Set auto-lock timeout to ${opt.label}`}
              >
                {opt.label}
              </ChoiceButton>
            ))}
          </div>
        </section>

        <SettingsDivider />

        <section style={{ display: "flex", flexDirection: "column", gap: 0 }} aria-label="Lock triggers">
          <SettingsSwitch label="Lock on sleep" description="Lock when the screen locks or machine sleeps" checked={lockOnSleep} onChange={() => updateSettings({ lockOnSleep: !lockOnSleep })} />
          <SettingsDivider />
          <SettingsSwitch label="Lock on window blur" description="Lock when the app loses focus" checked={lockOnWindowBlur} onChange={() => updateSettings({ lockOnWindowBlur: !lockOnWindowBlur })} />
        </section>

        <SettingsDivider />

        <section style={sectionStyle} aria-label="Clear clipboard after">
          <SettingsSectionLabel>Clear clipboard after</SettingsSectionLabel>
          <div style={optionGroupStyle}>
            {CLIPBOARD_OPTIONS.map((opt) => (
              <ChoiceButton
                key={opt.value}
                active={opt.value === clipboardClearSeconds}
                onClick={() => updateSettings({ clipboardClearSeconds: opt.value })}
                ariaLabel={`Clear clipboard after ${opt.label}`}
              >
                {opt.label}
              </ChoiceButton>
            ))}
          </div>
        </section>

        <SettingsDivider />

        <section style={{ display: "flex", flexDirection: "column", gap: 0 }} aria-label="Approval requirements">
          <SettingsSwitch label="Password for burn" description="Require password before burning QU" checked={requirePasswordForBurn} onChange={() => updateSettings({ requirePasswordForBurn: !requirePasswordForBurn })} />
          <SettingsDivider />
          <SettingsSwitch label="Biometric for seed reveal" description={isLinux ? "Require quick unlock to view seed" : "Require biometric to view seed"} checked={requireBiometricForSeedReveal} onChange={() => updateSettings({ requireBiometricForSeedReveal: !requireBiometricForSeedReveal })} />
        </section>

        {bioAvailable && vault && (
          <>
            <SettingsDivider />
            <section style={sectionStyle} aria-label="Biometric unlock">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <SettingsSectionLabel>{isLinux ? "Quick unlock" : "Biometric unlock"}</SettingsSectionLabel>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                  {bioEnabled ? `Enabled for ${vault.name}` : `Enable faster unlock for ${vault.name}`}
                </span>
              </div>
              {bioEnabled ? (
                <Button variant="danger" size="md" style={{ width: "100%" }} onClick={handleDisable}>
                  Disable
                </Button>
              ) : enabling ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
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
                <Button variant="secondary" size="md" onClick={() => setEnabling(true)}>
                  Enable for {vault.name}
                </Button>
              )}
            </section>
          </>
        )}
      </motion.div>
    </AppShell>
  );
}
