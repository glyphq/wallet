import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
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
          <SectionLabel>RPC endpoints</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={labelStyle}>Live API</span>
            <input value={liveUrl} onChange={(e) => { setLiveUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/live/v1" style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={labelStyle}>Archive API</span>
            <input value={queryUrl} onChange={(e) => { setQueryUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/query/v1" style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <motion.button
              {...gesture.press}
              onClick={testAndSave}
              disabled={!liveUrl.trim() || !queryUrl.trim() || testStatus === "testing"}
              style={{
                padding: "var(--space-2) var(--space-4)", background: "var(--color-accent)",
                border: "none", borderRadius: "var(--radius-sharp)", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                color: "var(--color-bg-base)", opacity: testStatus === "testing" ? 0.6 : 1,
              }}
            >
              {testStatus === "testing" ? "Testing..." : "Test & save"}
            </motion.button>
            <motion.button {...gesture.pressSubtle} onClick={resetToDefaults} style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              color: "var(--color-text-disabled)", padding: 0,
            }}>
              Reset
            </motion.button>
            {testStatus === "ok" && testTick !== null && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-success)" }}>
                Tick #{testTick}
              </span>
            )}
            {testStatus === "error" && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
                {testError || "Unreachable"}
              </span>
            )}
          </div>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
            Custom endpoints must use HTTPS
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--color-border-subtle)" }} />

        {/* Tick offset */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div>
            <SectionLabel>Transaction tick offset</SectionLabel>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)" }}>
              Target tick = current + offset. Higher values give more time to confirm.
            </span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {TICK_PRESETS.map((v) => (
              <motion.button
                key={v}
                {...gesture.pressSubtle}
                onClick={() => updateSettings({ tickOffset: v })}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: v === settings.tickOffset ? "var(--color-accent)" : "var(--color-bg-surface)",
                  color: v === settings.tickOffset ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  border: "none", borderRadius: "var(--radius-pill)", cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                }}
              >
                +{v}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
  fontWeight: 500, color: "var(--color-text-secondary)",
};

const inputStyle: React.CSSProperties = {
  background: "transparent", border: "none",
  borderBottom: "1px solid var(--color-border-subtle)",
  padding: "var(--space-2) 0", fontFamily: "var(--font-sans)",
  fontSize: "var(--text-body)", color: "var(--color-text-primary)", outline: "none", width: "100%",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
      fontWeight: 600, color: "var(--color-text-disabled)",
      textTransform: "none", letterSpacing: "0.06em",
    }}>
      {children}
    </span>
  );
}
