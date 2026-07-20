import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { Input } from "@/components/input";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { TextButton } from "@/components/text-button";
import { formatDate } from "@/lib/format";
import { usePersistedStore, type RequestHistoryItem } from "@/store/persisted";

const TYPE_LABEL: Record<RequestHistoryItem["type"], string> = {
  transfer: "Send QU",
  sc_call: "Contract call",
  sign_message: "Sign message",
  verify_message: "Verify signature",
  connect: "Connect",
};

export default function RequestHistoryScreen() {
  const requestHistory = usePersistedStore((s) => s.requestHistory);
  const clearRequestHistory = usePersistedStore((s) => s.clearRequestHistory);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = q
    ? requestHistory.filter(
        (item) =>
          item.dappName.toLowerCase().includes(q) ||
          item.dappOrigin.toLowerCase().includes(q) ||
          TYPE_LABEL[item.type].toLowerCase().includes(q) ||
          item.action.includes(q),
      )
    : requestHistory;

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Request history" />

        {/* Search + clear */}
        {requestHistory.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by dApp, type..."
              containerStyle={{ flex: 1 }}
            />
            <TextButton onClick={clearRequestHistory} tone="muted" style={{ flexShrink: 0 }}>
              Clear all
            </TextButton>
          </div>
        )}

        {/* Empty */}
        {requestHistory.length === 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "var(--space-8) 0",
            fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
            color: "var(--color-text-disabled)",
          }}>
            No request history
          </div>
        )}

        {/* List */}
        {filtered.length > 0 && (
          <div style={{
            background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", overflow: "hidden",
          }}>
            {filtered.map((item, i) => (
              <div key={item.id} style={{
                padding: "var(--space-3) var(--space-4)",
                borderTop: i > 0 ? "1px solid var(--color-border-subtle)" : "none",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: item.action === "approved" ? "var(--color-text-primary)" : "var(--color-status-error)" }}>
                    {TYPE_LABEL[item.type]}
                  </span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
                    {formatDate(item.createdAt) || "—"}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: 2, display: "block" }}>
                  {item.dappName || "Unknown dApp"} · {item.action}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No search results */}
        {requestHistory.length > 0 && filtered.length === 0 && (
          <div style={{
            fontFamily: "var(--font-sans)", fontSize: "var(--text-body)",
            color: "var(--color-text-disabled)", textAlign: "center", padding: "var(--space-4) 0",
          }}>
            No results
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}
