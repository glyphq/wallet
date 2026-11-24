import { useState } from "react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@/lib/icons";
import { formatDate } from "@/lib/format";
import type { AppSettings } from "@/store/persisted";
import { useUpdater } from "@/hooks/use-updater";
import { cspModeDetail, cspModeLabel } from "./csp-mode";
import { DiagnosticRow } from "./diagnostic-primitives";

/** Collapsible security policy and updater diagnostics. */
export function TechnicalDetails({ updater, settings }: { updater: ReturnType<typeof useUpdater>; settings: AppSettings }) {
  const [showTechnical, setShowTechnical] = useState(false);

  return (
    <section style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-5)", paddingBottom: "var(--space-6)" }}>
      <button
        type="button"
        onClick={() => setShowTechnical((value) => !value)}
        aria-expanded={showTechnical}
        style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: 0, background: "transparent", border: "none", cursor: "pointer", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}
      >
        Technical details
        {showTechnical ? <ArrowUp01Icon size={16} strokeWidth={1.5} aria-hidden="true" /> : <ArrowDown01Icon size={16} strokeWidth={1.5} aria-hidden="true" />}
      </button>
      <span style={{ display: "block", marginTop: 4, color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>Security policy and update diagnostics for advanced troubleshooting.</span>
      {showTechnical && (
        <div style={{ marginTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
          <DiagnosticRow label="CSP mode" value={cspModeLabel()} />
          <DiagnosticRow label="CSP policy" value={cspModeDetail()} technical />
          <DiagnosticRow label="Last update check" value={formatDate(updater.lastCheckedAt) || "Never"} />
          <DiagnosticRow label="Update error" value={updater.lastError || (updater.checkError ? "Update check failed" : "None")} tone={updater.lastError || updater.checkError ? "error" : undefined} />
          <DiagnosticRow label="Debug mode" value={settings.debugMode ? "On" : "Off"} />
          <DiagnosticRow label="Blur-lock bypass" value={settings.allowBlurLockBypass ? "On" : "Off"} />
        </div>
      )}
    </section>
  );
}
