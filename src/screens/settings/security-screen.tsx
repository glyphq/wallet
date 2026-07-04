import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Clipboard,
  Fire,
  Eye,
  FaceScanCircle,
  MoonSleep,
  LockKeyhole,
} from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { unlockVault } from "@/lib/vault";
import { extractMessage } from "@/lib/format";
import { isWatchOnlyVault } from "@/lib/accounts";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};

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

function ToggleRow({ icon, label, description, enabled, onToggle }: {
  icon: React.ReactNode; label: string; description: string; enabled: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "var(--space-3) 0", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)", marginTop: 2 }}>
          {description}
        </div>
      </div>
      <div style={{
        width: 36, height: 20, borderRadius: "var(--radius-pill)", flexShrink: 0, position: "relative",
        background: enabled ? "var(--color-accent)" : "var(--color-border-strong)",
        transition: "background 0.15s ease",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: "50%", background: enabled ? "var(--color-bg-base)" : "var(--color-text-disabled)",
          position: "absolute", top: 2, left: enabled ? 18 : 2, transition: "left 0.15s ease",
        }} />
      </div>
    </button>
  );
}

function PillGroup({ options, selected, onSelect }: {
  options: { label: string; value: number }[]; selected: number; onSelect: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
      {options.map((opt) => {
        const active = opt.value === selected;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-pill)", border: "none", cursor: "pointer",
              background: active ? "var(--color-accent)" : "var(--color-bg-elevated)",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
              color: active ? "var(--color-bg-base)" : "var(--color-text-secondary)",
              transition: "background 0.12s ease, color 0.12s ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...labelStyle, color: "var(--color-text-disabled)", display: "block", marginBottom: "var(--space-2)", marginTop: "var(--space-3)" }}>
      {children}
    </span>
  );
}

export default function SecurityScreen() {
  const isLinux = navigator.userAgent.toLowerCase().includes("linux");

  const autoLockMinutes = usePersistedStore((s) => s.settings.autoLockMinutes);
  const lockOnWindowBlur = usePersistedStore((s) => s.settings.lockOnWindowBlur);
  const lockOnSleep = usePersistedStore((s) => s.settings.lockOnSleep);
  const clipboardClearSeconds = usePersistedStore((s) => s.settings.clipboardClearSeconds);
  const requirePasswordForBurn = usePersistedStore((s) => s.settings.requirePasswordForBurn);
  const requireBiometricForSeedReveal = usePersistedStore((s) => s.settings.requireBiometricForSeedReveal);
  const biometricVaultIds = usePersistedStore((s) => s.settings.biometricVaultIds) ?? [];
  const vaults = usePersistedStore((s) => s.vaults);
  const settings = usePersistedStore((s) => s.settings);
  const allowBlurLockBypass = settings.allowBlurLockBypass;
  const updateSettings = usePersistedStore((s) => s.updateSettings);

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
    setEnableLoading(true);
    setEnableError("");
    if (!vault.encryptedData) { setEnableError("Vault data missing"); setEnableLoading(false); return; }
    try {
      await unlockVault(vault.encryptedData, enablePw);
    } catch {
      setEnableError("Wrong password");
      setEnableLoading(false);
      return;
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
    try {
      await invoke("disable_biometric", { vaultId: vault.id });
    } catch {
      // keyring entry may already be gone
    }
    updateSettings({ biometricVaultIds: biometricVaultIds.filter((id) => id !== vault.id) });
  }

  function setLockTimeout(minutes: number) {
    updateSettings({ autoLockMinutes: minutes });
    invoke("set_lock_timeout", { minutes }).catch(() => {});
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <motion.div
        initial={{ y: 4 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", minHeight: 0 }}
      >
        {/* Inline header — slot hidden for /settings/* routes */}
        <SettingsPageHeader title="Security" />
        {/* Lock card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)" }}>
            <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><Lock size={22} weight="Linear" /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Lock behavior
            </span>
          </div>
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />

          <SectionLabel>Auto-lock timeout</SectionLabel>
          <PillGroup options={TIMEOUT_OPTIONS} selected={autoLockMinutes} onSelect={setLockTimeout} />

          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "var(--space-3) calc(-1 * var(--space-4)) 0" }} />
          <ToggleRow
            icon={<MoonSleep size={22} weight="Linear" />}
            label="Lock on sleep"
            description="Lock when the screen locks or machine sleeps"
            enabled={lockOnSleep}
            onToggle={() => updateSettings({ lockOnSleep: !lockOnSleep })}
          />

          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            icon={<LockKeyhole size={22} weight="Linear" />}
            label="Lock on window blur"
            description="Lock immediately when the app loses focus"
            enabled={lockOnWindowBlur}
            onToggle={() => updateSettings({ lockOnWindowBlur: !lockOnWindowBlur })}
          />
          {lockOnWindowBlur && (
            <span style={{ ...labelStyle, color: "var(--color-status-warning)", display: "block", marginTop: "var(--space-1)" }}>
              Paranoid mode — app locks every time you switch windows
            </span>
          )}
          {lockOnWindowBlur && allowBlurLockBypass && (
            <span style={{ ...labelStyle, color: "var(--color-status-error)", display: "block", marginTop: "var(--space-1)" }}>
              Blur-lock bypass is enabled. Turn it off in network settings.
            </span>
          )}
        </div>

        {/* Clipboard card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)" }}>
            <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><Clipboard size={22} weight="Linear" /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Clipboard
            </span>
          </div>
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <SectionLabel>Clear copied addresses after</SectionLabel>
          <PillGroup options={CLIPBOARD_OPTIONS} selected={clipboardClearSeconds} onSelect={(v) => updateSettings({ clipboardClearSeconds: v })} />
        </div>

        {/* Approval policies card */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)" }}>
            <span style={{ flexShrink: 0, color: "var(--color-text-disabled)" }}><ShieldCheck size={22} weight="Linear" /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Approval policies
            </span>
          </div>
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />

          <ToggleRow
            icon={<Fire size={22} weight="Linear" />}
            label="Require password for burn"
            description="Ask for the vault password before broadcasting burns"
            enabled={requirePasswordForBurn}
            onToggle={() => updateSettings({ requirePasswordForBurn: !requirePasswordForBurn })}
          />

          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <ToggleRow
            icon={<Eye size={22} weight="Linear" />}
            label="Require biometric for seed reveal"
            description="Use vault biometric path instead of password-only when available"
            enabled={requireBiometricForSeedReveal}
            onToggle={() => updateSettings({ requireBiometricForSeedReveal: !requireBiometricForSeedReveal })}
          />

        </div>

        {/* Biometric card — highlighted */}
        <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", border: bioEnabled ? "1px solid var(--color-accent)" : "1px solid var(--color-border-subtle)", position: "relative", overflow: "hidden" }}>
          {bioEnabled && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--color-accent)" }} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", paddingBottom: "var(--space-2)" }}>
            <span style={{ flexShrink: 0, color: bioEnabled ? "var(--color-accent)" : "var(--color-text-disabled)" }}><FaceScanCircle size={22} weight={bioEnabled ? "Bold" : "Linear"} /></span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {isLinux ? "Quick unlock" : "Biometric unlock"}
            </span>
            {bioEnabled && (
              <span style={{
                fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600,
                color: "var(--color-accent)",
                padding: "2px var(--space-2)", borderRadius: "var(--radius-pill)",
                background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                marginLeft: "auto",
              }}>
                Active
              </span>
            )}
          </div>
          <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
          <div style={{ paddingTop: "var(--space-3)" }}>
            <span style={{ ...labelStyle, display: "block", marginBottom: "var(--space-2)" }}>
              {isLinux
                ? "Use Linux secure storage to unlock vaults without retyping the password"
                : "Use Touch ID or Windows Hello to unlock vaults"}
            </span>

            {isLinux && bioAvailable === true && (
              <span style={{ ...labelStyle, color: "var(--color-text-disabled)", display: "block", marginBottom: "var(--space-2)" }}>
                Uses system secret service — password stored securely, no biometric prompt
              </span>
            )}

            {bioAvailable === null && (
              <span style={{ ...labelStyle, color: "var(--color-text-disabled)" }}>Checking...</span>
            )}

            {bioAvailable === false && (
              <span style={{ ...labelStyle, color: "var(--color-text-disabled)" }}>Not available on this device</span>
            )}

            {bioAvailable === true && !vault && (
              <span style={{ ...labelStyle, color: "var(--color-text-disabled)" }}>No vault selected</span>
            )}

            {bioAvailable === true && vault && watchOnly && (
              <span style={{ ...labelStyle, color: "var(--color-text-disabled)" }}>Watch-only vaults don't need biometric unlock</span>
            )}

            {bioAvailable === true && vault && !watchOnly && !bioEnabled && !enabling && (
              <button
                onClick={() => setEnabling(true)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "var(--space-3) 0", width: "100%", background: "none", border: "none", cursor: "pointer",
                }}
              >
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  Enable for {vault.name}
                </span>
                <div style={{
                  width: 36, height: 20, borderRadius: "var(--radius-pill)", flexShrink: 0, position: "relative",
                  background: "var(--color-border-strong)",
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", background: "var(--color-text-disabled)",
                    position: "absolute", top: 2, left: 2,
                  }} />
                </div>
              </button>
            )}

            {enabling && !watchOnly && (
              <div style={{
                display: "flex", flexDirection: "column", gap: "var(--space-3)",
                marginTop: "var(--space-3)", padding: "var(--space-4)",
                background: "var(--color-bg-elevated)", borderRadius: "var(--radius-card)",
              }}>
                <span style={{ ...labelStyle }}>
                  Confirm your vault password to enable {isLinux ? "quick unlock" : "biometric unlock"}
                </span>
                <div style={{ position: "relative" }}>
                  <input
                    ref={pwRef}
                    type="password"
                    autoComplete="new-password"
                    value={enablePw}
                    onChange={(e) => setEnablePw(e.target.value)}
                    placeholder="Vault password"
                    onKeyDown={(e) => e.key === "Enter" && handleEnable()}
                    className="glyph-input"
                    style={{
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
                      color: "var(--color-text-primary)", background: "var(--color-bg-surface)",
                      borderRadius: "var(--radius-sharp)", padding: "var(--space-3) var(--space-4)",
                      width: "100%", boxSizing: "border-box",
                      border: "1px solid var(--color-border-strong)",
                    }}
                  />
                </div>
                {enableError && (
                  <span style={{ ...labelStyle, color: "var(--color-status-error)" }}>{enableError}</span>
                )}
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button
                    onClick={handleEnable}
                    disabled={enableLoading || !enablePw}
                    style={{
                      flex: 1, padding: "var(--space-3)", border: "none", cursor: enableLoading || !enablePw ? "default" : "pointer",
                      opacity: enableLoading || !enablePw ? 0.4 : 1, borderRadius: "var(--radius-sharp)",
                      background: "var(--color-accent)", fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-label)", fontWeight: 600, color: "var(--color-bg-base)",
                    }}
                  >
                    {enableLoading ? "Saving..." : "Enable"}
                  </button>
                  <button
                    onClick={() => { setEnabling(false); setEnablePw(""); setEnableError(""); }}
                    style={{
                      padding: "var(--space-3) var(--space-4)", background: "var(--color-bg-elevated)", border: "1px solid var(--color-border-strong)",
                      borderRadius: "var(--radius-sharp)", cursor: "pointer",
                      fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {bioAvailable === true && vault && !watchOnly && bioEnabled && (
              <button
                onClick={handleDisable}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "var(--space-3) 0", width: "100%", background: "none", border: "none", cursor: "pointer",
                }}
              >
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-accent)" }}>
                  Enabled for {vault.name}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-status-warning)" }}>
                  Disable
                </span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
