import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { Toggle } from "@/components/toggle";
import { usePersistedStore } from "@/store/persisted";
import { verifyWalletPassword } from "@/lib/wallet";
import { extractMessage } from "@/lib/format";

const MAX_TIMEOUT_MINUTES = 24 * 60;

const TIMEOUT_OPTIONS = [
  { label: "Off", value: 0 },
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

export default function SecurityScreen() {
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");
  const settings = usePersistedStore((s) => s.settings);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const wallets = usePersistedStore((s) => s.wallets);

  const { autoLockMinutes, lockOnWindowBlur, lockOnSleep, clipboardClearSeconds,
    requireBiometricForSeedReveal } = settings;
  const biometricWalletIds = settings.biometricWalletIds ?? [];
  const wallet = wallets.find((v) => v.id === settings.activeWalletId) ?? wallets[0];
  const bioEnabled = wallet ? biometricWalletIds.includes(wallet.id) : false;

  const [customOpen, setCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customError, setCustomError] = useState("");
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
    if (!wallet) return;
    setEnableLoading(true); setEnableError("");
    if (!wallet.encryptedData) { setEnableError("Wallet data missing"); setEnableLoading(false); return; }
    try { await verifyWalletPassword(wallet.encryptedData, enablePw); }
    catch { setEnableError("Wrong password"); setEnableLoading(false); return; }
    const pw = enablePw; setEnablePw("");
    try {
      await invoke("enable_biometric", { walletId: wallet.id, walletData: wallet.encryptedData, password: pw });
      updateSettings({ biometricWalletIds: [...biometricWalletIds, wallet.id] });
      setEnabling(false);
    } catch (e) { setEnableError(`Secure storage failed: ${extractMessage(e)}`); }
    finally { setEnableLoading(false); }
  }

  async function handleDisable() {
    if (!wallet) return;
    try { await invoke("disable_biometric", { walletId: wallet.id }); } catch { /* ok */ }
    updateSettings({ biometricWalletIds: biometricWalletIds.filter((id) => id !== wallet.id) });
  }

  const customTimeout = autoLockMinutes > 0 && !TIMEOUT_OPTIONS.some((option) => option.value === autoLockMinutes);

  function timeoutLabel(minutes: number): string {
    if (minutes % 60 === 0) return `${minutes / 60}h`;
    if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${minutes}m`;
  }

  function setLockTimeout(minutes: number) {
    updateSettings({ autoLockMinutes: minutes });
    invoke("set_lock_timeout", { minutes }).catch(() => {});
  }

  function chooseTimeout(minutes: number) {
    setLockTimeout(minutes);
    setCustomOpen(false);
    setCustomError("");
  }

  function openCustomTimeout() {
    setCustomOpen(true);
    setCustomError("");
    setCustomMinutes(String(customTimeout ? autoLockMinutes : 10));
  }

  function applyCustomTimeout() {
    const minutes = Number.parseInt(customMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_TIMEOUT_MINUTES) {
      setCustomError(`Enter 1–${MAX_TIMEOUT_MINUTES} minutes.`);
      return;
    }
    setLockTimeout(minutes);
    setCustomOpen(false);
    setCustomError("");
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Security" />

        <section style={sectionStyle} aria-label="Auto-lock timeout">
          <SettingsSectionLabel>Auto-lock timeout</SettingsSectionLabel>
          <div style={optionGroupStyle}>
            {TIMEOUT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={opt.value === autoLockMinutes ? "primary" : "secondary"}
                style={{ width: "auto" }}
                aria-pressed={opt.value === autoLockMinutes}
                aria-label={`Set auto-lock timeout to ${opt.label}`}
                onClick={() => chooseTimeout(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant={customTimeout || customOpen ? "primary" : "secondary"}
              style={{ width: "auto" }}
              aria-pressed={customTimeout}
              aria-expanded={customOpen}
              aria-label="Set a custom auto-lock timeout"
              onClick={openCustomTimeout}
            >
              {customTimeout ? `Custom · ${timeoutLabel(autoLockMinutes)}` : "Custom"}
            </Button>
          </div>
          {customOpen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxWidth: 280 }}>
              <Input
                label="Custom timeout (minutes)"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={customMinutes}
                onChange={(event) => { setCustomMinutes(event.target.value.replace(/\D/g, "")); setCustomError(""); }}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyCustomTimeout(); } }}
                error={customError || undefined}
              />
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button size="sm" onClick={applyCustomTimeout}>Apply</Button>
                <Button size="sm" variant="ghost" onClick={() => { setCustomOpen(false); setCustomError(""); }}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </section>

        <SettingsDivider fullBleed />

        <section style={sectionStyle} aria-label="Lock triggers">
          <SettingsSectionLabel>Lock triggers</SettingsSectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <Toggle label="Lock on sleep" description="Lock when the screen locks or machine sleeps" checked={lockOnSleep} onChange={(checked) => updateSettings({ lockOnSleep: checked })} />
            <SettingsDivider fullBleed />
            <Toggle label="Lock on window blur" description="Lock when the app loses focus" checked={lockOnWindowBlur} onChange={(checked) => updateSettings({ lockOnWindowBlur: checked })} />
          </div>
        </section>

        <SettingsDivider fullBleed />

        <section style={sectionStyle} aria-label="Clear clipboard after">
          <SettingsSectionLabel>Clear clipboard after</SettingsSectionLabel>
          <div style={optionGroupStyle}>
            {CLIPBOARD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={opt.value === clipboardClearSeconds ? "primary" : "secondary"}
                style={{ width: "auto" }}
                aria-pressed={opt.value === clipboardClearSeconds}
                aria-label={`Clear clipboard after ${opt.label}`}
                onClick={() => updateSettings({ clipboardClearSeconds: opt.value })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </section>

        {bioAvailable ? (
          <>
            <SettingsDivider fullBleed />

            <section style={sectionStyle} aria-label="Approval requirements">
              <SettingsSectionLabel>Approval requirements</SettingsSectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <Toggle label="Biometric for seed reveal" description={isLinux ? "Require quick unlock to view seed" : "Require biometric to view seed"} checked={requireBiometricForSeedReveal} onChange={(checked) => updateSettings({ requireBiometricForSeedReveal: checked })} />
              </div>
            </section>
          </>
        ) : null}

        {bioAvailable && wallet && (
          <>
            <SettingsDivider fullBleed />
            <section style={sectionStyle} aria-label="Biometric unlock">
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <SettingsSectionLabel>{isLinux ? "Quick unlock" : "Biometric unlock"}</SettingsSectionLabel>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
                  {bioEnabled ? `Enabled for ${wallet.name}` : `Enable faster unlock for ${wallet.name}`}
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
                  Enable for {wallet.name}
                </Button>
              )}
            </section>
          </>
        )}
      </motion.div>
    </AppShell>
  );
}
