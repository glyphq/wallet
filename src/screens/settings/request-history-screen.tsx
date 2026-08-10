import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Magnifier, TrashBinMinimalistic } from "@solar-icons/react";
import { stepMotion } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { IconButton } from "@/components/icon-button";
import { Input } from "@/components/input";
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

const ACTION_LABEL: Record<RequestHistoryItem["action"], string> = {
  approved: "Approved",
  rejected: "Rejected",
};

function HistoryRow({ item }: { item: RequestHistoryItem }) {
  const approved = item.action === "approved";
  const account = item.accountName || item.accountIdentity;
  const createdAt = formatDate(item.createdAt) || "—";

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        padding: "var(--space-4) 0",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
          {TYPE_LABEL[item.type]}
        </span>
        <time
          style={{ flexShrink: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}
        >
          {createdAt}
        </time>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: "var(--space-3)", rowGap: "var(--space-1)" }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
          {item.dappName || "Unknown dApp"}
        </span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600, color: approved ? "var(--color-accent)" : "var(--color-status-error)" }}>
          {ACTION_LABEL[item.action]}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", columnGap: "var(--space-3)", rowGap: "var(--space-1)" }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)" }}>
          {item.dappOrigin}
        </span>
        {account ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            {account}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default function RequestHistoryScreen() {
  const requestHistory = usePersistedStore((s) => s.requestHistory);
  const clearRequestHistory = usePersistedStore((s) => s.clearRequestHistory);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requestHistory;

    return requestHistory.filter((item) =>
      item.dappName.toLowerCase().includes(query)
      || item.dappOrigin.toLowerCase().includes(query)
      || TYPE_LABEL[item.type].toLowerCase().includes(query)
      || ACTION_LABEL[item.action].toLowerCase().includes(query),
    );
  }, [requestHistory, search]);

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}>
      <motion.main {...stepMotion} style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <SettingsPageHeader title="Request history" />

        {requestHistory.length === 0 ? (
          <section aria-label="Request history" style={{ padding: "var(--space-8) 0", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
              No requests yet
            </span>
          </section>
        ) : (
          <>
            <section aria-label="Search request history" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search requests"
                leftElement={<Magnifier size={18} weight="Linear" />}
                containerStyle={{ flex: 1 }}
              />
              <IconButton
                label="Clear request history"
                onClick={clearRequestHistory}
                style={{ flexShrink: 0, color: "var(--color-status-error)" }}
              >
                <TrashBinMinimalistic size={20} weight="Linear" aria-hidden="true" />
              </IconButton>
            </section>

            {filtered.length > 0 ? (
              <section aria-label="Request history results">
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)", paddingBottom: "var(--space-2)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-text-disabled)", letterSpacing: "0.06em" }}>
                    Activity
                  </span>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
                    {filtered.length} of {requestHistory.length}
                  </span>
                </div>
                {filtered.map((item) => <HistoryRow key={item.id} item={item} />)}
              </section>
            ) : (
              <section aria-label="No matching requests" style={{ padding: "var(--space-8) 0", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)" }}>
                  No matching requests
                </span>
              </section>
            )}
          </>
        )}
      </motion.main>
    </AppShell>
  );
}
