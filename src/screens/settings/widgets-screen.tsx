import { useEffect, useState } from "react";
import { createWidgetWindow, closeWidgetWindow, setWidgetConfig } from "tauri-plugin-widgets-api";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Textarea } from "@/components/textarea";
import { SettingsPageHeader } from "@/components/settings-page-header";
import {
  GLYPH_OVERVIEW_WIDGET_ID,
  GLYPH_OVERVIEW_WIDGET_LABEL,
  GLYPH_WIDGET_GROUP,
  parseWidgetConfig,
  STANDARD_WIDGET_PRESETS,
  stringifyWidgetConfig,
} from "@/lib/glyph-widget";
import { usePersistedStore } from "@/store/persisted";

type Status = { tone: "success" | "error" | "muted"; text: string };

export default function WidgetsScreen() {
  const storedConfig = usePersistedStore((s) => s.settings.widgetConfigJson);
  const updateSettings = usePersistedStore((s) => s.updateSettings);
  const [json, setJson] = useState(storedConfig ?? stringifyWidgetConfig());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<Status>({ tone: "muted", text: "Edit every supported widget element as JSON." });

  useEffect(() => {
    setJson(storedConfig ?? stringifyWidgetConfig());
  }, [storedConfig]);

  async function applyConfig(config: NonNullable<ReturnType<typeof parseWidgetConfig>>, serialized: string, openWindow: boolean) {
    try {
      const result = await setWidgetConfig(config, GLYPH_WIDGET_GROUP, GLYPH_OVERVIEW_WIDGET_ID);
      updateSettings({ widgetConfigJson: serialized });
      if (openWindow) {
        await createWidgetWindow({
          label: GLYPH_OVERVIEW_WIDGET_LABEL,
          width: 300,
          height: 190,
          group: GLYPH_WIDGET_GROUP,
          widgetId: GLYPH_OVERVIEW_WIDGET_ID,
          size: "small",
          skipTaskbar: true,
        });
      }
      const reload = result.reload.outcome === "ok" ? "updated" : result.reload.outcome;
      setStatus({ tone: "success", text: openWindow ? `Widget ${reload} and opened.` : `Widget ${reload}.` });
    } catch {
      setStatus({ tone: "error", text: "Widgets are not available on this platform or build." });
    }
  }

  async function apply(openWindow: boolean) {
    const config = parseWidgetConfig(json);
    if (!config) {
      setStatus({ tone: "error", text: "Enter valid widget JSON under 128 KB." });
      return;
    }
    await applyConfig(config, json, openWindow);
  }

  function usePreset(config: NonNullable<ReturnType<typeof parseWidgetConfig>>) {
    const serialized = stringifyWidgetConfig(config);
    setJson(serialized);
    void applyConfig(config, serialized, true);
  }

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <SettingsPageHeader title="Widgets" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <strong style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)" }}>Standard widgets</strong>
          <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>
            Choose a ready-to-use private widget. Each preset opens a desktop preview and contains no balance, identity, transaction, or seed data.
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {STANDARD_WIDGET_PRESETS.map((preset) => (
            <button key={preset.id} type="button" onClick={() => usePreset(preset.config)} style={{ padding: "var(--space-4)", textAlign: "left", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-card)", background: "var(--color-bg-surface)", cursor: "pointer" }}>
              <strong style={{ display: "block", color: "var(--color-text-primary)", fontSize: "var(--text-body)" }}>{preset.name}</strong>
              <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>{preset.description}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button size="md" style={{ width: "auto" }} onClick={() => void apply(true)}>Open selected widget</Button>
          <Button size="md" variant="ghost" style={{ width: "auto" }} onClick={() => setShowAdvanced((current) => !current)}>{showAdvanced ? "Hide advanced" : "Advanced customization"}</Button>
          <Button size="md" variant="ghost" style={{ width: "auto" }} onClick={() => void closeWidgetWindow(GLYPH_OVERVIEW_WIDGET_LABEL).then(() => setStatus({ tone: "muted", text: "Desktop widget closed." })).catch(() => setStatus({ tone: "error", text: "Could not close the desktop widget." }))}>Close</Button>
        </div>
        {showAdvanced && (
          <Textarea
            label="Advanced widget JSON"
            value={json}
            onChange={(event) => setJson(event.target.value)}
            rows={18}
            technical
            spellCheck={false}
            error={status.tone === "error" ? status.text : undefined}
            hint="Use small, medium, and large roots plus any elements supported by tauri-plugin-widgets."
            style={{ minHeight: 340 }}
          />
        )}
        {status.tone !== "error" && <span role="status" style={{ color: status.tone === "success" ? "var(--color-status-success)" : "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>{status.text}</span>}
        <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>
          <strong style={{ color: "var(--color-text-primary)" }}>Privacy note</strong><br />
          Widget data can be accessible outside the locked wallet window on some platforms. Do not add balances, identities, addresses, transaction history, or other sensitive values unless you accept that exposure.
        </div>
      </div>
    </AppShell>
  );
}
