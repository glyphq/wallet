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
import { createQubicClient, configureRpc, normalizeRpcUrl } from "@/lib/rpc";
import { identifyNetworkPreset, NETWORK_PRESETS, type NetworkPresetId } from "@/lib/network-presets";

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

  const [liveUrl, setLiveUrl] = useState(settings.network.liveApiUrl);
  const [queryUrl, setQueryUrl] = useState(settings.network.queryApiUrl);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkPresetId>(settings.network.name);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testTick, setTestTick] = useState<number | null>(null);
  const [testError, setTestError] = useState("");

  async function testAndSave() {
    const live = normalizeRpcUrl(liveUrl.trim());
    const archive = normalizeRpcUrl(queryUrl.trim());
    if (!live || !archive) {
      setTestStatus("error");
      setTestError("HTTPS URLs are required.");
      return;
    }
    setTestStatus("testing");
    setTestTick(null);
    setTestError("");
    try {
      const client = createQubicClient({ liveBaseUrl: live, archiveBaseUrl: archive });
      const result = await client.live.getTickInfo();
      if (!result.ok) throw new Error("bad response");
      setTestTick(result.value.tick ?? null);
      setTestStatus("ok");
      configureRpc(live, archive);
      updateSettings({
        network: {
          ...settings.network,
          liveApiUrl: live,
          queryApiUrl: archive,
          name: identifyNetworkPreset(live, archive, selectedNetwork),
        },
      });
      queryClient.invalidateQueries();
    } catch {
      setTestStatus("error");
      setTestError("Could not reach endpoints.");
    }
  }

  function resetToDefaults() {
    const mainnet = NETWORK_PRESETS[0];
    const defaultLive = mainnet.liveApiUrl ?? "";
    const defaultQuery = mainnet.queryApiUrl ?? "";
    setLiveUrl(defaultLive); setQueryUrl(defaultQuery); setSelectedNetwork("mainnet");
    setTestStatus("idle"); setTestError("");
    configureRpc(defaultLive, defaultQuery);
    updateSettings({ network: { liveApiUrl: defaultLive, queryApiUrl: defaultQuery, name: "mainnet" } });
    queryClient.invalidateQueries();
  }

  function choosePreset(preset: (typeof NETWORK_PRESETS)[number]) {
    setSelectedNetwork(preset.id);
    setTestStatus("idle"); setTestError("");
    if (preset.liveApiUrl && preset.queryApiUrl) {
      setLiveUrl(preset.liveApiUrl);
      setQueryUrl(preset.queryApiUrl);
    } else if (preset.id === "testnet") {
      setLiveUrl("");
      setQueryUrl("");
    }
  }

  const activeNetwork = identifyNetworkPreset(liveUrl, queryUrl, selectedNetwork);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Network" />

        <section style={sectionStyle} aria-label="RPC endpoints">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <SettingsSectionLabel>Network</SettingsSectionLabel>
            <span id="rpc-endpoint-help" style={helperStyle}>
              Mainnet uses bundled endpoints. Testnet and custom require verified HTTPS RPC URLs.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {NETWORK_PRESETS.map((preset) => (
              <Button key={preset.id} size="sm" variant={activeNetwork === preset.id ? "primary" : "secondary"} style={{ width: "auto" }} onClick={() => choosePreset(preset)} aria-pressed={activeNetwork === preset.id}>
                {preset.label}
              </Button>
            ))}
          </div>
          <Input id="live-api-url" label="Live API" type="url" inputMode="url" autoCapitalize="none" aria-describedby="rpc-endpoint-help" value={liveUrl} onChange={(e) => { setLiveUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/live/v1" />
          <Input id="archive-api-url" label="Archive API" type="url" inputMode="url" autoCapitalize="none" aria-describedby="rpc-endpoint-help" value={queryUrl} onChange={(e) => { setQueryUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/query/v1" />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button size="md" style={{ width: "auto" }} onClick={testAndSave} disabled={!liveUrl.trim() || !queryUrl.trim() || testStatus === "testing"} aria-busy={testStatus === "testing"}>
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
