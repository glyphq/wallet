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

const TICK_PRESETS = [5, 10, 15, 20, 30, 50] as const;
type TestStatus = "idle" | "testing" | "ok" | "error";

export default function NetworkScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const queryClient = useQueryClient();

  const [liveUrl, setLiveUrl] = useState(settings.network.liveApiUrl);
  const [queryUrl, setQueryUrl] = useState(settings.network.queryApiUrl);
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
          name: live === "https://rpc.qubic.org/live/v1" && archive === "https://rpc.qubic.org/query/v1" ? "mainnet" : "custom",
        },
      });
      queryClient.invalidateQueries();
    } catch {
      setTestStatus("error");
      setTestError("Could not reach endpoints.");
    }
  }

  function resetToDefaults() {
    const defaultLive = "https://rpc.qubic.org/live/v1";
    const defaultQuery = "https://rpc.qubic.org/query/v1";
    setLiveUrl(defaultLive); setQueryUrl(defaultQuery);
    setTestStatus("idle"); setTestError("");
    configureRpc(defaultLive, defaultQuery);
    updateSettings({ network: { liveApiUrl: defaultLive, queryApiUrl: defaultQuery, name: "mainnet" } });
    queryClient.invalidateQueries();
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Network" />

        {/* RPC endpoints */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <SettingsSectionLabel>RPC endpoints</SettingsSectionLabel>
          <Input id="live-api-url" label="Live API" type="url" inputMode="url" autoCapitalize="none" aria-describedby="rpc-endpoint-help" value={liveUrl} onChange={(e) => { setLiveUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/live/v1" />
          <Input id="archive-api-url" label="Archive API" type="url" inputMode="url" autoCapitalize="none" aria-describedby="rpc-endpoint-help" value={queryUrl} onChange={(e) => { setQueryUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/query/v1" />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Button size="md" style={{ width: "auto" }} onClick={testAndSave} disabled={!liveUrl.trim() || !queryUrl.trim() || testStatus === "testing"} aria-busy={testStatus === "testing"}>
              {testStatus === "testing" ? "Testing..." : "Test & save"}
            </Button>
            <TextButton onClick={resetToDefaults} tone="muted" style={{ minHeight: 44, padding: "0 var(--space-2)" }}>
              Reset
            </TextButton>
            {testStatus === "ok" && testTick !== null && (
              <span role="status" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-success)" }}>
                Tick #{testTick}
              </span>
            )}
            {testStatus === "error" && (
              <span role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
                {testError || "Unreachable"}
              </span>
            )}
          </div>
          <span id="rpc-endpoint-help" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
            Custom endpoints must use HTTPS
          </span>
        </div>

        {/* Divider */}
        <SettingsDivider />

        {/* Tick offset */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div>
            <SettingsSectionLabel>Transaction tick offset</SettingsSectionLabel>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
              Target tick = current + offset. Higher values give more time to confirm.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {TICK_PRESETS.map((v) => (
              <Button key={v} size="sm" variant={v === settings.tickOffset ? "primary" : "secondary"} style={{ width: "auto" }} onClick={() => updateSettings({ tickOffset: v })}>
                +{v}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
