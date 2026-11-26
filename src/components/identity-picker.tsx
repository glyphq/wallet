import { useMemo, useState } from "react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { FramedAvatar } from "@/components/framed-avatar";
import { Input } from "@/components/input";
import { PageFrame } from "@/components/page-header";
import { ScreenHeader } from "@/components/screen-header";
import { truncateId } from "@/lib/format";
import type { Contact } from "@/store/persisted";

export interface IdentityPickerAccount {
  name: string;
  identity: string;
}

/** Full-screen contact/account chooser matching the contact editor layout. */
export function IdentityPickerScreen({
  title,
  contacts,
  accounts,
  onSelect,
  onClose,
}: {
  title: string;
  contacts: Contact[];
  accounts: IdentityPickerAccount[];
  onSelect: (identity: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filteredAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          !query ||
          account.name.toLowerCase().includes(query) ||
          account.identity.toLowerCase().includes(query),
      ),
    [accounts, query],
  );
  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          !query ||
          contact.name.toLowerCase().includes(query) ||
          contact.identity.toLowerCase().includes(query),
      ),
    [contacts, query],
  );
  const hasResults = filteredAccounts.length > 0 || filteredContacts.length > 0;

  function choose(identity: string) {
    setSearch("");
    onSelect(identity);
  }

  return (
    <AppShell
      fullBleed
      statusBar={<ScreenHeader title={title} onBack={onClose} backAriaLabel="Back" />}
      contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}
    >
      <PageFrame
        actions={(
          <Button variant="secondary" size="md" onClick={onClose} style={{ width: "100%" }}>
            Cancel
          </Button>
        )}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", maxWidth: 480, margin: "0 auto" }}>
          <Input
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Contacts or accounts"
            autoComplete="off"
            autoFocus
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {filteredAccounts.length > 0 ? (
              <IdentityPickerSection
                title="This wallet"
                entries={filteredAccounts}
                onSelect={choose}
              />
            ) : null}
            {filteredContacts.length > 0 ? (
              <IdentityPickerSection title="Contacts" entries={filteredContacts} onSelect={choose} />
            ) : null}
            {!hasResults ? (
              <div style={{ padding: "var(--space-6) var(--space-4)", textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  No results
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </PageFrame>
    </AppShell>
  );
}

function IdentityPickerSection({
  title,
  entries,
  onSelect,
}: {
  title: string;
  entries: { name: string; identity: string }[];
  onSelect: (identity: string) => void;
}) {
  return (
    <section aria-label={title} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
        {title}
      </span>
      <div className="corner-frame" style={{ display: "flex", flexDirection: "column", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)", overflow: "hidden" }}>
        {entries.map((entry, index) => (
          <button
            key={entry.identity}
            type="button"
            onClick={() => onSelect(entry.identity)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              width: "100%",
              padding: "var(--space-3) var(--space-4)",
              border: 0,
              borderTop: index === 0 ? undefined : "1px solid var(--color-border-subtle)",
              background: "transparent",
              color: "inherit",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <FramedAvatar seed={entry.identity} size={32} />
            <span style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", color: "var(--color-text-primary)", overflowWrap: "anywhere" }}>
                {entry.name}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-tertiary)" }}>
                {truncateId(entry.identity, 8, 8)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
