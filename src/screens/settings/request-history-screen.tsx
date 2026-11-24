import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { ChevronRight01Icon, Delete02Icon } from "@/lib/icons";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { PageFrame } from "@/components/page-header";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { formatDate } from "@/lib/format";
import { usePersistedStore, type RequestHistoryItem } from "@/store/persisted";
import { REQUEST_ACTION_LABEL, REQUEST_TYPE_LABEL } from "./request-history-labels";

function actionColor(action: RequestHistoryItem["action"]) {
  if (action === "approved") return "var(--color-accent)";
  if (action === "expired") return "var(--color-status-warning)";
  return "var(--color-status-error)";
}

export default function RequestHistoryScreen() {
  const navigate = useNavigate();
  const requestHistory = usePersistedStore((s) => s.requestHistory);
  const clearRequestHistory = usePersistedStore((s) => s.clearRequestHistory);
  const [confirmClear, setConfirmClear] = useState(false);

  const actions = requestHistory.length === 0 ? undefined : confirmClear ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <p style={{ margin: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)" }}>
        Clear all request history? This does not change any connected dApp.
      </p>
      <Button variant="danger" size="md" style={{ width: "100%" }} onClick={() => { clearRequestHistory(); setConfirmClear(false); }}>
        <Delete02Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        Clear history
      </Button>
      <Button variant="ghost" size="md" style={{ width: "100%" }} onClick={() => setConfirmClear(false)}>
        Keep history
      </Button>
    </div>
  ) : (
    <Button variant="danger" size="md" style={{ width: "100%" }} onClick={() => setConfirmClear(true)}>
      <Delete02Icon size={16} strokeWidth={1.5} aria-hidden="true" />
      Clear request history
    </Button>
  );

  return (
    <AppShell fullBleed contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <SettingsPageHeader title="Request history" />
      <PageFrame actions={actions}>
        <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {requestHistory.length === 0 ? (
            <section aria-label="Request history" style={{ padding: "var(--space-8) 0" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                No requests yet
              </span>
            </section>
          ) : (
            <div className="request-history-list" aria-label="Request history">
              {requestHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="request-history-row"
                  onClick={() => navigate(`/settings/request-history/detail?id=${encodeURIComponent(item.id)}`)}
                >
                  <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.dappName || "Unknown dApp"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {REQUEST_TYPE_LABEL[item.type]} · {item.dappOrigin}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", fontWeight: 500, color: actionColor(item.action) }}>
                        {REQUEST_ACTION_LABEL[item.action]}
                      </span>
                      <time style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
                        {formatDate(item.createdAt) || "—"}
                      </time>
                    </span>
                    <ChevronRight01Icon size={16} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-text-tertiary)" }} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </PageFrame>
    </AppShell>
  );
}
