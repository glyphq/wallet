import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { createQubicClient, configureRpc, normalizeRpcUrl } from "@/lib/rpc";

function sanitizeRpcUrl(value: string): string | null {
  return normalizeRpcUrl(value.trim());
}

type TestStatus = "idle" | "testing" | "ok" | "error";

const CURRENCIES = ["USD", "EUR", "BTC"] as const;
const TICK_PRESETS = [5, 10, 15, 20, 30, 50] as const;

const labelStyle = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  fontWeight: 500,
  color: "var(--color-text-secondary)",
};

const inputStyle: React.CSSProperties = {
  background: "transparent",
  borderBottom: "1px solid var(--color-border-subtle)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  border: "none",
  outline: "none",
  padding: "var(--space-2) 0",
  width: "100%",
  color: "var(--color-text-primary)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--color-bg-surface)",
  borderRadius: "var(--radius-card)",
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "var(--space-2) var(--space-4)",
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-bg-base)" : "var(--color-text-secondary)",
    border: "none",
    borderRadius: "var(--radius-pill)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-label)",
    fontWeight: 500,
  };
}

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
    const live = sanitizeRpcUrl(liveUrl);
    const archive = sanitizeRpcUrl(queryUrl);
    if (!live || !archive) {
      setTestStatus("error");
      setTestError("HTTPS RPC URLs are required.");
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
          name:
            live === "https://rpc.qubic.org/live/v1" &&
            archive === "https://rpc.qubic.org/query/v1"
              ? "mainnet"
              : "custom",
        },
      });
      queryClient.invalidateQueries();
    } catch {
      setTestStatus("error");
      setTestError("Endpoint check failed.");
    }
  }

  function resetToDefaults() {
    const defaultLive = "https://rpc.qubic.org/live/v1";
    const defaultQuery = "https://rpc.qubic.org/query/v1";
    setLiveUrl(defaultLive);
    setQueryUrl(defaultQuery);
    setTestStatus("idle");
    configureRpc(defaultLive, defaultQuery);
    updateSettings({ network: { liveApiUrl: defaultLive, queryApiUrl: defaultQuery, name: "mainnet" } });
    queryClient.invalidateQueries();
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <motion.div initial={{ y: 4 }} animate={{ y: 0 }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Network" />

        {/* RPC endpoints */}
        <div style={cardStyle}>
          <div>
            <span style={labelStyle}>Live API</span>
            <input
              value={liveUrl}
              onChange={(e) => { setLiveUrl(e.target.value); setTestStatus("idle"); setTestError(""); }}
              placeholder="https://rpc.qubic.org/live/v1"
              style={{ ...inputStyle, marginTop: "var(--space-1)" }}
            />
          </div>
          <div>
            <span style={labelStyle}>Archive API</span>
            <input
              value={queryUrl}
              onChange={(e) => { setQueryUrl(e.target.value); setTestStatus("idle"); setTestError(""); }}
              placeholder="https://rpc.qubic.org/query/v1"
              style={{ ...inputStyle, marginTop: "var(--space-1)" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button
              onClick={testAndSave}
              disabled={!liveUrl.trim() || !queryUrl.trim() || testStatus === "testing"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-label)",
                fontWeight: 500,
                color: "var(--color-accent)",
                padding: 0,
              }}
            >
              {testStatus === "testing" ? "Testing\u2026" : "Test & save"}
            </button>
            <button
              onClick={resetToDefaults}
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", padding: 0 }}
            >
              Reset to defaults
            </button>
            {testStatus === "ok" && testTick !== null && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-success)" }}>
                Tick #{testTick}
              </span>
            )}
            {testStatus === "error" && (
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>
                Unreachable
              </span>
            )}
          </div>
          {testError && (
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>
              {testError}
            </div>
          )}
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
            Custom RPCs must use HTTPS
          </div>
        </div>

        {/* Display currency */}
        <div style={cardStyle}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Display currency
            </div>
            <div style={{ ...labelStyle, marginTop: "var(--space-1)" }}>
              Used for fiat equivalent when price data is available
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => updateSettings({ currency: c })}
                style={pillStyle(c === settings.currency)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Tick offset */}
        <div style={cardStyle}>
          <div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
              Transaction tick offset
            </div>
            <div style={{ ...labelStyle, marginTop: "var(--space-1)" }}>
              Target tick = current tick + offset. Higher = more time to confirm.
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {TICK_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => updateSettings({ tickOffset: v })}
                style={pillStyle(v === settings.tickOffset)}
              >
                +{v}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
