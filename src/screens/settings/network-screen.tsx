import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore } from "@/store/persisted";
import { createQubicClient, configureRpc, normalizeRpcUrl } from "@/lib/rpc";

const CURRENCIES = ["USD", "EUR", "BTC"] as const;
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
    setLiveUrl(defaultLive);
    setQueryUrl(defaultQuery);
    setTestStatus("idle");
    setTestError("");
    configureRpc(defaultLive, defaultQuery);
    updateSettings({ network: { liveApiUrl: defaultLive, queryApiUrl: defaultQuery, name: "mainnet" } });
    queryClient.invalidateQueries();
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", paddingBottom: "calc(var(--space-4) + 76px)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Network" />

        {/* RPC endpoints */}
        <Card>
          <CardHeader>RPC endpoints</CardHeader>
          <Field label="Live API">
            <input value={liveUrl} onChange={(e) => { setLiveUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/live/v1" style={inputStyle} />
          </Field>
          <Field label="Archive API">
            <input value={queryUrl} onChange={(e) => { setQueryUrl(e.target.value); setTestStatus("idle"); setTestError(""); }} placeholder="https://rpc.qubic.org/query/v1" style={inputStyle} />
          </Field>
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
            <motion.button
              {...gesture.pressSubtle}
              onClick={resetToDefaults}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                color: "var(--color-text-disabled)", padding: 0,
              }}
            >
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
        </Card>

        {/* Display currency */}
        <Card>
          <CardHeader>Display currency</CardHeader>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {CURRENCIES.map((c) => (
              <motion.button
                key={c}
                {...gesture.pressSubtle}
                onClick={() => updateSettings({ currency: c })}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: c === settings.currency ? "var(--color-accent)" : "var(--color-bg-elevated)",
                  color: c === settings.currency ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  border: "none", borderRadius: "var(--radius-pill)", cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                }}
              >
                {c}
              </motion.button>
            ))}
          </div>
        </Card>

        {/* Tick offset */}
        <Card>
          <CardHeader>Transaction tick offset</CardHeader>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: "-var(--space-1)" }}>
            Target tick = current + offset. Higher values give more time to confirm.
          </span>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {TICK_PRESETS.map((v) => (
              <motion.button
                key={v}
                {...gesture.pressSubtle}
                onClick={() => updateSettings({ tickOffset: v })}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: v === settings.tickOffset ? "var(--color-accent)" : "var(--color-bg-elevated)",
                  color: v === settings.tickOffset ? "var(--color-bg-base)" : "var(--color-text-secondary)",
                  border: "none", borderRadius: "var(--radius-pill)", cursor: "pointer",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500,
                }}
              >
                +{v}
              </motion.button>
            ))}
          </div>
        </Card>
      </motion.div>
    </AppShell>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "var(--space-3)",
      background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
      padding: "var(--space-4)",
    }}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)",
      fontWeight: 600, color: "var(--color-text-disabled)",
      textTransform: "uppercase" as const, letterSpacing: "0.06em",
    }}>
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "transparent", border: "none",
  borderBottom: "1px solid var(--color-border-subtle)",
  padding: "var(--space-2) 0", fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)", color: "var(--color-text-primary)", outline: "none", width: "100%",
};
