import { useReducer, useState } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { SettingsSectionLabel, SettingsDivider } from "@/components/settings-section-elements";
import { TextButton } from "@/components/text-button";
import { usePersistedStore } from "@/store/persisted";
import { createRpcClientForNetwork } from "@/lib/rpc-cache-identity";
import { resolveNetworkConfig, type NetworkConfig } from "@/lib/network-config";
import { identifyNetworkPreset, NETWORK_PRESETS } from "@/lib/network-presets";
import { fetchLocalNetworkManifest } from "@/lib/rpc-transport";
import {
  INITIAL_LOCAL_READINESS_STATE,
  reduceLocalReadinessState,
  validateLocalNetworkManifest,
  verifyLocalNetworkReadiness,
  type ReadinessCapability,
} from "./local-testnet-readiness";

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

const capabilityLabels: Record<ReadinessCapability, string> = {
  manifest: "Dev-kit manifest matches this local network",
  live: "Live API returns a valid tick",
  query: "Query API returns a valid indexed tick",
  progress: "Live tick advances",
};

function errorMessage(error: unknown, local: boolean): string {
  const detail = error instanceof Error ? error.message : "Unknown readiness error.";
  if (!local) return `Could not validate both RPC endpoints. ${detail}`;
  if (/manifest/i.test(detail)) {
    return `${detail} Start the dev-kit with ./scripts/up.sh, then retry.`;
  }
  if (/timed out|did not advance/i.test(detail)) {
    return `${detail} Wait for core-lite to produce ticks, then retry.`;
  }
  return `${detail} Run ./scripts/check-local-network.sh in the dev-kit for diagnostics.`;
}

function resultValue<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) throw new Error(`${label} request failed.`);
  return result.value;
}

export default function NetworkScreen() {
  const settings = usePersistedStore((s) => s.settings);
  const updateSettings = usePersistedStore((s) => s.updateSettings);

  const [liveUrl, setLiveUrl] = useState(settings.network.liveApiUrl);
  const [queryUrl, setQueryUrl] = useState(settings.network.queryApiUrl);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testTick, setTestTick] = useState<number | null>(null);
  const [testError, setTestError] = useState("");
  const [localReadiness, dispatchLocalReadiness] = useReducer(
    reduceLocalReadinessState,
    INITIAL_LOCAL_READINESS_STATE,
  );

  function resetTestState() {
    setTestStatus("idle");
    setTestTick(null);
    setTestError("");
    dispatchLocalReadiness({ type: "reset" });
  }

  async function testAndSave() {
    let draft: NetworkConfig;
    try {
      draft = resolveNetworkConfig({ liveApiUrl: liveUrl, queryApiUrl: queryUrl });
    } catch {
      setTestStatus("error");
      setTestError("Enter two valid HTTPS URLs, or choose the exact Local testnet preset.");
      return;
    }

    const isLocal = draft.name === "testnet";
    setTestStatus("testing");
    setTestTick(null);
    setTestError("");
    if (isLocal) dispatchLocalReadiness({ type: "start" });

    try {
      let snapshot = draft;
      if (isLocal) {
        const manifestController = new AbortController();
        const manifestTimeout = setTimeout(
          () => manifestController.abort(new Error("Local manifest request timed out.")),
          5_000,
        );
        try {
          const manifest = await fetchLocalNetworkManifest({ signal: manifestController.signal });
          snapshot = validateLocalNetworkManifest(manifest).config;
          dispatchLocalReadiness({
            type: "capability",
            capability: "manifest",
            instanceId: snapshot.manifestInstanceId ?? undefined,
          });
        } finally {
          clearTimeout(manifestTimeout);
        }
      }

      // This client and canonical config are immutable for the entire probe.
      const client = createRpcClientForNetwork(snapshot);

      let currentTick: number;
      if (isLocal) {
        const ready = await verifyLocalNetworkReadiness(
          {
            readLiveTick: async (signal) => {
              const value = resultValue(await client.live.getTickInfo({ signal }), "Live API");
              return value.tick;
            },
            readQueryTick: async (signal) => {
              const value = resultValue(
                await client.archive.getLastProcessedTick({ signal }),
                "Query API",
              );
              return value.tickNumber;
            },
          },
          {
            onCapability: (capability, tick) =>
              dispatchLocalReadiness({ type: "capability", capability, tick }),
          },
        );
        currentTick = ready.liveTick;
        dispatchLocalReadiness({ type: "ready" });
      } else {
        const [liveResult, queryResult] = await Promise.all([
          client.live.getTickInfo(),
          client.archive.getLastProcessedTick(),
        ]);
        const live = resultValue(liveResult, "Live API");
        resultValue(queryResult, "Query API");
        if (!Number.isSafeInteger(live.tick) || (live.tick ?? -1) < 0) {
          throw new Error("Live API returned an invalid tick.");
        }
        currentTick = live.tick as number;
      }

      // Centralized store-driven RPC synchronization owns the active singleton and cache retirement.
      updateSettings({
        network: {
          liveApiUrl: snapshot.liveApiUrl,
          queryApiUrl: snapshot.queryApiUrl,
          manifestInstanceId: snapshot.manifestInstanceId,
        },
      });
      setTestTick(currentTick);
      setTestStatus("ok");
    } catch (error) {
      const message = errorMessage(error, isLocal);
      setTestStatus("error");
      setTestError(message);
      if (isLocal) dispatchLocalReadiness({ type: "error", message });
    }
  }

  function resetToDefaults() {
    const mainnet = NETWORK_PRESETS[0];
    const defaultLive = mainnet.liveApiUrl ?? "";
    const defaultQuery = mainnet.queryApiUrl ?? "";
    setLiveUrl(defaultLive);
    setQueryUrl(defaultQuery);
    setTestStatus("idle");
    setTestError("");
    updateSettings({ network: { liveApiUrl: defaultLive, queryApiUrl: defaultQuery } });
  }

  function choosePreset(preset: (typeof NETWORK_PRESETS)[number]) {
    setTestStatus("idle");
    setTestError("");
    dispatchLocalReadiness({ type: "reset" });
    if (preset.liveApiUrl && preset.queryApiUrl) {
      setLiveUrl(preset.liveApiUrl);
      setQueryUrl(preset.queryApiUrl);
    } else {
      setLiveUrl("");
      setQueryUrl("");
    }
  }

  const activeNetwork = identifyNetworkPreset(liveUrl, queryUrl);
  const showLocalReadiness = activeNetwork === "testnet";
  const localInstanceLabel = localReadiness.instanceId
    ? `${localReadiness.instanceId.slice("qubic-local:".length, "qubic-local:".length + 8)}…${localReadiness.instanceId.slice(-4)}`
    : null;

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Network" />

        <section style={sectionStyle} aria-label="RPC endpoints">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <SettingsSectionLabel>Network</SettingsSectionLabel>
            <span id="rpc-endpoint-help" style={helperStyle}>
              Custom endpoints require HTTPS. Local testnet uses the fixed loopback dev-kit endpoints.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {NETWORK_PRESETS.map((preset) => (
              <Button key={preset.id} size="sm" variant={activeNetwork === preset.id ? "primary" : "secondary"} style={{ width: "auto" }} onClick={() => choosePreset(preset)} aria-pressed={activeNetwork === preset.id}>
                {preset.label}
              </Button>
            ))}
          </div>
          <Input id="live-api-url" label="Live API" type="url" inputMode="url" autoCapitalize="none" aria-describedby="rpc-endpoint-help" value={liveUrl} onChange={(e) => { setLiveUrl(e.target.value); resetTestState(); }} placeholder="https://rpc.qubic.org/live/v1" />
          <Input id="archive-api-url" label="Archive API" type="url" inputMode="url" autoCapitalize="none" aria-describedby="rpc-endpoint-help" value={queryUrl} onChange={(e) => { setQueryUrl(e.target.value); resetTestState(); }} placeholder="https://rpc.qubic.org/query/v1" />

          {showLocalReadiness && (
            <div style={{ display: "flex", minWidth: 0, flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
              <strong style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-sm)" }}>Local testnet readiness</strong>
              {(Object.keys(capabilityLabels) as ReadinessCapability[]).map((capability) => {
                const complete = localReadiness.completed.includes(capability);
                return (
                  <span key={capability} style={{ ...helperStyle, color: complete ? "var(--color-status-success)" : "var(--color-text-secondary)" }}>
                    {complete ? "✓" : localReadiness.phase === "checking" ? "○" : "·"} {capabilityLabels[capability]}
                  </span>
                );
              })}
              {localReadiness.instanceId && (
                <span
                  aria-label={`Local testnet instance ${localReadiness.instanceId}`}
                  title={localReadiness.instanceId}
                  style={helperStyle}
                >
                  Instance: {localInstanceLabel}
                </span>
              )}
              <span style={helperStyle}>
                Requires the dev-kit stack and manifest server. Saving stays disabled until every check passes.
              </span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button size="md" style={{ width: "auto" }} onClick={testAndSave} disabled={!liveUrl.trim() || !queryUrl.trim() || testStatus === "testing"} aria-busy={testStatus === "testing"}>
              {testStatus === "testing" ? (showLocalReadiness ? "Checking readiness..." : "Testing...") : "Test & save"}
            </Button>
            <TextButton onClick={resetToDefaults} tone="muted" style={{ minHeight: 44, padding: "0 var(--space-2)" }}>
              Reset
            </TextButton>
          </div>
          {testStatus === "ok" && testTick !== null && (
            <span role="status" style={{ ...helperStyle, color: "var(--color-status-success)" }}>
              {showLocalReadiness ? `Local testnet ready and saved at tick #${testTick}.` : `Connected. Current tick #${testTick}.`}
            </span>
          )}
          {testStatus === "error" && (
            <span role="alert" style={{ ...helperStyle, color: "var(--color-status-error)" }}>
              {testError || "Network validation failed."}
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
