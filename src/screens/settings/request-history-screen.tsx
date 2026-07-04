import { useState } from "react";
import { motion } from "framer-motion";

import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
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
    <AppShell
      fullBleed
      contentStyle={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <motion.div
        initial={{ y: 4 }}
        animate={{ y: 0 }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
      >
        <SettingsPageHeader title="Request history" />

        {requestHistory.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by dApp, type..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--color-border-strong)",
                borderRadius: 0,
                padding: "var(--space-2) 0",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                color: "var(--color-text-display)",
                outline: "none",
              }}
            />
            <button
              onClick={clearRequestHistory}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-small)",
                color: "var(--color-text-disabled)",
                padding: 0,
                flexShrink: 0,
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {requestHistory.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--color-text-disabled)",
              textAlign: "center",
            }}
          >
            No request history
          </div>
        )}

        {requestHistory.length > 0 && filtered.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--color-text-disabled)",
              textAlign: "center",
            }}
          >
            No results
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((item, i) => (
            <>
              {i > 0 && <div style={{ height: 1, background: "var(--color-border-subtle)" }} />}
              <div
                key={item.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                  padding: "var(--space-3) 0",
                }}
              >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  color: item.action === "approved" ? "var(--color-text-primary)" : "var(--color-status-error)",
                }}
              >
                {TYPE_LABEL[item.type]}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-small)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {item.dappName || "Unknown dApp"} · {item.action}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  color: "var(--color-text-disabled)",
                }}
              >
                {formatDate(item.createdAt) || "—"}
              </span>
              </div>
            </>
          ))}
        </div>
      </motion.div>
    </AppShell>
  );
}
