import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { AddCircleIcon, Download01Icon, Search01Icon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { IconButton } from "@/components/icon-button";
import { ScreenHeader } from "@/components/screen-header";
import { Input } from "@/components/input";
import { SettingsDivider, SettingsSectionLabel } from "@/components/settings-section-elements";
import { usePersistedStore } from "@/store/persisted";
import { ContactRow, EmptyState } from "./contact-row";

export default function ContactsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromSettings = location.pathname.startsWith("/settings/contacts");
  const routeSuffix = fromSettings ? "?from=settings" : "";
  const savedContactId = (location.state as { savedContactId?: string } | null)?.savedContactId ?? null;
  const contacts = usePersistedStore((state) => state.contacts);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => contacts
    .filter((contact) => {
      if (!search.trim()) return true;
      const query = search.trim().toLowerCase();
      return contact.name.toLowerCase().includes(query)
        || contact.identity.toLowerCase().includes(query)
        || contact.note.toLowerCase().includes(query)
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
          action={(
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <IconButton label="Import or export contacts" title="Import or export contacts" onClick={() => navigate(`/contacts/transfer${routeSuffix}`)}>
                <Download01Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </IconButton>
              <IconButton label="Add contact" title="Add contact" onClick={() => navigate(`/contacts/new${routeSuffix}`)}>
                <AddCircleIcon size={21} strokeWidth={1.5} aria-hidden="true" />
              </IconButton>
            </div>
          )}
        />
      )}
      contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}
    >
      <main style={{ width: "min(100%, 640px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input
          aria-label="Search contacts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, address, note, or tag"
          containerStyle={{ width: "100%" }}
          style={{ fontFamily: "var(--font-sans)" }}
          leftElement={<Search01Icon size={18} strokeWidth={1.5} />}
        />

        <SettingsDivider fullBleed />

        <section aria-label="Contacts" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <SettingsSectionLabel>Contacts</SettingsSectionLabel>
          {filtered.length === 0 ? (
            <EmptyState hasContacts={contacts.length > 0} onAdd={() => navigate(`/contacts/new${routeSuffix}`)} />
          ) : (
            <div className="contacts-list" aria-label="Saved contacts">
              {filtered.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  highlighted={savedContactId === contact.id}
                  onSend={() => navigate(`/send?to=${contact.identity}`)}
                  onEdit={() => navigate(`/contacts/${contact.id}/edit${routeSuffix}`)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
