import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { AltArrowDown, Magnifier, TrashBinMinimalistic } from "@solar-icons/react";
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

const CALLBACK_LABEL: Record<RequestHistoryItem["callbackStatus"], string> = {
  none: "No callback",
  pending: "Sending callback",
  ok: "Callback delivered",
  failed: "Callback failed",
};

function RequestDetail({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(88px, 0.4fr) minmax(0, 1fr)", gap: "var(--space-4)", alignItems: "baseline" }}>
      <dt style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{label}</dt>
      <dd style={{ margin: 0, minWidth: 0, overflowWrap: "anywhere", fontFamily: technical ? "var(--font-mono)" : "var(--font-sans)", fontSize: technical ? "var(--text-mono-sm)" : "var(--text-label)", color: "var(--color-text-secondary)" }}>{value}</dd>
    </div>
  );
}

function HistoryRow({ item, expanded, onToggle }: { item: RequestHistoryItem; expanded: boolean; onToggle: () => void }) {
  const approved = item.action === "approved";
  const account = item.accountName || item.accountIdentity;
  const createdAt = formatDate(item.createdAt) || "—";
  const detailsId = `request-history-${item.id}`;

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
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={onToggle}
        style={{ width: "100%", padding: 0, background: "none", border: "none", color: "inherit", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {TYPE_LABEL[item.type]}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
            <time style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>{createdAt}</time>
            <AltArrowDown size={16} weight="Linear" aria-hidden="true" style={{ color: "var(--color-text-tertiary)", transform: expanded ? "rotate(180deg)" : undefined, transition: "transform var(--duration-fast) var(--ease-out)" }} />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: "var(--space-3)", rowGap: "var(--space-1)", marginTop: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
            {item.dappName || "Unknown dApp"}
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600, color: approved ? "var(--color-accent)" : "var(--color-status-error)" }}>
            {ACTION_LABEL[item.action]}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", columnGap: "var(--space-3)", rowGap: "var(--space-1)", marginTop: "var(--space-1)" }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)" }}>
            {item.dappOrigin}
          </span>
          {account ? (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
              {account}
            </span>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <dl id={detailsId} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", margin: "var(--space-2) 0 0", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
          <RequestDetail label="Decision" value={ACTION_LABEL[item.action]} />
          <RequestDetail label="Origin" value={item.dappOrigin} technical />
          {account ? <RequestDetail label="Account" value={account} technical={!item.accountName} /> : null}
          {item.resultDetail ? <RequestDetail label="Result" value={item.resultDetail} technical /> : null}
          <RequestDetail label="Callback" value={CALLBACK_LABEL[item.callbackStatus]} />
          {item.callbackUrl ? <RequestDetail label="Callback URL" value={item.callbackUrl} technical /> : null}
        </dl>
      ) : null}
    </article>
  );
}

export default function RequestHistoryScreen() {
  const requestHistory = usePersistedStore((s) => s.requestHistory);
  const clearRequestHistory = usePersistedStore((s) => s.clearRequestHistory);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                {filtered.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)}
                  />
                ))}
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
