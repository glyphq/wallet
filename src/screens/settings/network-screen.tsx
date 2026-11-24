import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { TextButton } from "@/components/text-button";
import { usePersistedStore } from "@/store/persisted";
import { configureApiClient, getApiBaseUrl } from "@/lib/api/client";
import { normalizeApiUrl } from "@/lib/api-url";
import { getStatus } from "@/lib/api/generated";
import { apiErrorMessage } from "@/lib/api/problems";
import { identifyNetworkPreset, NETWORK_PRESETS } from "@/lib/network-presets";

const TICK_PRESETS = [5, 10, 15, 20, 30, 50] as const;
type TestStatus = "idle" | "testing" | "ok" | "error";

const sectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
} as const;

const helperStyle = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-caption)",
  color: "var(--color-text-secondary)",
} as const;

export default function NetworkScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const queryClient = useQueryClient();

  const [apiUrl, setApiUrl] = useState(settings.network.apiUrl);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testTick, setTestTick] = useState<number | null>(null);
  const [testError, setTestError] = useState("");

  async function testAndSave() {
    const normalized = normalizeApiUrl(apiUrl);
    if (!normalized) {
      setTestStatus("error");
      setTestError("An HTTPS API URL is required.");
      return;
    }
    const previous = getApiBaseUrl();
    const configured = configureApiClient(normalized);
    setTestStatus("testing");
    setTestTick(null);
    setTestError("");
    try {
      const { data } = await getStatus({ throwOnError: true });
      if (!data?.data) throw new Error("Glyph API returned no status payload");
      setTestTick(data.data.network?.head ?? data.data.head?.tick ?? null);
      setTestStatus("ok");
      updateSettings({
        network: { apiUrl: configured, name: identifyNetworkPreset(configured) },
      });
      queryClient.invalidateQueries();
    } catch (error) {
      configureApiClient(previous);
      setTestStatus("error");
      setTestError(apiErrorMessage(error));
    }
  }

  function resetToDefaults() {
    const mainnet = NETWORK_PRESETS[0];
    const defaultApi = mainnet.apiUrl ?? "";
    setApiUrl(defaultApi);
    setTestStatus("idle");
    setTestError("");
    configureApiClient(defaultApi);
    updateSettings({ network: { apiUrl: defaultApi, name: "mainnet" } });
    queryClient.invalidateQueries();
  }

  function choosePreset(preset: (typeof NETWORK_PRESETS)[number]) {
    setTestStatus("idle");
    setTestError("");
    if (preset.apiUrl) {
      setApiUrl(preset.apiUrl);
    } else if (preset.id === "testnet") {
      setApiUrl("");
    }
  }

  const activeNetwork = identifyNetworkPreset(apiUrl);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Network" />

        <section style={sectionStyle} aria-label="Glyph API endpoint">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <SettingsSectionLabel>Network</SettingsSectionLabel>
            <span id="api-endpoint-help" style={helperStyle}>
              HTTPS Glyph API origin only. All chain reads and broadcasts use this service.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {NETWORK_PRESETS.map((preset) => (
              <Button key={preset.id} size="sm" variant={activeNetwork === preset.id ? "primary" : "secondary"} style={{ width: "auto" }} onClick={() => choosePreset(preset)} aria-pressed={activeNetwork === preset.id}>
                {preset.label}
              </Button>
            ))}
          </div>
          <Input id="api-url" label="API URL" type="url" inputMode="url" autoCapitalize="none" aria-describedby="api-endpoint-help" value={apiUrl} onChange={(e) => { setApiUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://api.glyphq.org" />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button size="md" style={{ width: "auto" }} onClick={testAndSave} disabled={!apiUrl.trim() || testStatus === "testing"} aria-busy={testStatus === "testing"}>
              {testStatus === "testing" ? "Testing..." : "Test & save"}
            </Button>
            <TextButton onClick={resetToDefaults} tone="muted" style={{ minHeight: 44, padding: "0 var(--space-2)" }}>
              Reset
            </TextButton>
          </div>
          {testStatus === "ok" && testTick !== null && (
            <span role="status" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-success)" }}>
              Connected. Current tick #{testTick}.
            </span>
          )}
          {testStatus === "ok" && testTick === null && (
            <span role="status" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-success)" }}>
              Connected.
            </span>
          )}
          {testStatus === "error" && (
            <span role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
              {testError || "Unreachable"}
            </span>
          )}
        </section>

        <SettingsDivider />

        <section style={sectionStyle} aria-label="Transaction tick offset">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <SettingsSectionLabel>Transaction tick offset</SettingsSectionLabel>
            <span style={helperStyle}>
              Target tick = current + offset. Higher values give more time to confirm.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {TICK_PRESETS.map((v) => (
              <Button key={v} size="sm" variant={v === settings.tickOffset ? "primary" : "secondary"} style={{ width: "auto" }} onClick={() => updateSettings({ tickOffset: v })} aria-pressed={v === settings.tickOffset}>
                +{v}
              </Button>
            ))}
          </div>
        </section>
      </motion.div>
    </AppShell>
  );
}
