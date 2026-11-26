import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AddCircleIcon, Download01Icon, Search01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { EmptyCollectionState } from "@/components/empty-collection-state";
import { PageFrame } from "@/components/page-header";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Input } from "@/components/input";
import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { usePersistedStore } from "@/store/persisted";
import { ContactRow } from "./contact-row";

export default function ContactsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromSettings = location.pathname.startsWith("/settings/contacts");
  const routeSuffix = fromSettings ? "?from=settings" : "";
  const contacts = usePersistedStore((state) => state.contacts);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => contacts
    .filter((contact) => {
      if (!search.trim()) return true;
      const query = search.trim().toLowerCase();
      return contact.name.toLowerCase().includes(query)
        || contact.identity.toLowerCase().includes(query)
        || (contact.tags ?? []).some((tag) => tag.includes(query));
    })
    .sort((left, right) => {
      if (left.lastUsedAt && right.lastUsedAt) return right.lastUsedAt - left.lastUsedAt;
      if (left.lastUsedAt) return -1;
      if (right.lastUsedAt) return 1;
      return left.name.localeCompare(right.name);
    }), [contacts, search]);

  return (
    <AppShell
      fullBleed
      statusBar={(
        <ScreenHeader
          title="Contacts"
          onBack={() => navigate(fromSettings ? "/settings" : "/history")}
          backAriaLabel={fromSettings ? "Back to settings" : "Back to history"}
        />
      )}
      contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}
    >
      <PageFrame actions={(
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button size="md" style={{ width: "100%" }} onClick={() => navigate(`/contacts/new${routeSuffix}`)}>
            <AddCircleIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            Add contact
          </Button>
          <Button variant="secondary" size="md" style={{ width: "100%" }} onClick={() => navigate(`/contacts/transfer${routeSuffix}`)}>
            <Download01Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            Import / export
          </Button>
        </div>
      )}>
      <main style={{ width: "min(100%, 640px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input
          aria-label="Search contacts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, address, or tag"
          containerStyle={{ width: "100%" }}
          style={{ fontFamily: "var(--font-sans)" }}
          leftElement={<Search01Icon size={18} strokeWidth={1.5} />}
        />

        <SettingsDivider fullBleed />

        <section aria-label="Contacts" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <SettingsSectionLabel>Contacts</SettingsSectionLabel>
          {filtered.length === 0 ? (
            <EmptyCollectionState
              icon={contacts.length > 0 ? "search" : "contacts"}
              title={contacts.length > 0 ? "No matching contacts" : "No contacts yet"}
              description={contacts.length > 0 ? "Try a different name, address, or tag." : "Save trusted recipients so sending stays quick and accurate."}
            />
          ) : (
            <div className="contacts-list" aria-label="Saved contacts">
              {filtered.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onSend={() => navigate(`/send?to=${contact.identity}`)}
                  onEdit={() => navigate(`/contacts/${contact.id}/edit${routeSuffix}`)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      </PageFrame>
    </AppShell>
  );
}
