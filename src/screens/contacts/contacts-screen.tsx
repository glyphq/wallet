import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { AddCircleIcon, Download01Icon, Search01Icon } from "@/lib/icons";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { ScreenHeader } from "@/components/screen-header";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type Contact } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";
import { ContactForm, ContactFormActions } from "./contact-form";
import { ContactRow, EmptyState } from "./contact-row";
import { contactsToCsv, contactsToJson, parseContactImport } from "./contacts-transfer";

export default function ContactsScreen() {
  const navigate = useNavigate();
  const contacts = usePersistedStore((state) => state.contacts);
  const addContact = usePersistedStore((state) => state.addContact);
  const updateContact = usePersistedStore((state) => state.updateContact);
  const removeContact = usePersistedStore((state) => state.removeContact);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formName, setFormName] = useState("");
  const [formIdentity, setFormIdentity] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formTags, setFormTags] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [transferStatus, setTransferStatus] = useState("");

  function parseTags(raw: string): string[] {
    return raw.split(/[,\s]+/).map((tag) => tag.trim().replace(/^#+/, "").toLowerCase()).filter(Boolean);
  }

  function resetForm() {
    setFormName("");
    setFormIdentity("");
    setFormNote("");
    setFormTags("");
    setIdentityError("");
  }

  function openAdd() {
    resetForm();
    setAdding(true);
  }

  function openEdit(contact: Contact) {
    setFormName(contact.name);
    setFormIdentity(contact.identity);
    setFormNote(contact.note);
    setFormTags((contact.tags ?? []).join(", "));
    setIdentityError("");
    setEditing(contact);
  }

  function validateIdentity(identity: string): boolean {
    if (!isValidIdentity(identity)) {
      setIdentityError("Enter a valid Qubic address.");
      return false;
    }
    setIdentityError("");
    return true;
  }

  function doAdd() {
    if (!formName.trim() || !validateIdentity(formIdentity.trim())) return;
    const contactId = newId();
    addContact({
      id: contactId,
      name: formName.trim(),
      identity: formIdentity.trim(),
      note: formNote.trim(),
      tags: parseTags(formTags),
      addedAt: Date.now(),
      lastUsedAt: 0,
    });
    setRecentlySavedId(contactId);
    setAdding(false);
  }

  function doEdit() {
    if (!editing || !formName.trim() || !validateIdentity(formIdentity.trim())) return;
    updateContact(editing.id, {
      name: formName.trim(),
      identity: formIdentity.trim(),
      note: formNote.trim(),
      tags: parseTags(formTags),
    });
    setRecentlySavedId(editing.id);
    setEditing(null);
  }

  async function exportContacts(format: "json" | "csv") {
    setTransferStatus("");
    try {
      const path = await save({
        defaultPath: `glyph-contacts.${format}`,
        filters: [{ name: format === "json" ? "JSON" : "CSV", extensions: [format] }],
      });
      if (!path) return;
      const content = format === "json" ? contactsToJson(contacts) : contactsToCsv(contacts);
      await writeTextFile(path, content);
      setTransferStatus(`Exported ${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`);
      setTransferring(false);
    } catch (err) {
      console.error("[glyph] contact export failed:", err);
      setTransferStatus("Could not export contacts.");
    }
  }

  async function importContacts() {
    setTransferStatus("");
    try {
      const path = await open({
        multiple: false,
        filters: [{ name: "Contacts", extensions: ["json", "csv"] }],
      });
      if (!path || Array.isArray(path)) return;
      const parsed = parseContactImport(await readTextFile(path), path);
      const existingIdentities = new Set(contacts.map((contact) => contact.identity));
      let added = 0;
      for (const contact of parsed) {
        if (existingIdentities.has(contact.identity)) continue;
        existingIdentities.add(contact.identity);
        addContact(contact);
        added += 1;
      }
      setTransferStatus(`Imported ${added} contact${added === 1 ? "" : "s"}${parsed.length > added ? `, skipped ${parsed.length - added} duplicate${parsed.length - added === 1 ? "" : "s"}` : ""}.`);
      setTransferring(false);
    } catch (err) {
      console.error("[glyph] contact import failed:", err);
      setTransferStatus(err instanceof Error ? err.message : "Could not import contacts.");
    }
  }

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

  const searchDescription = search.trim()
    ? `${filtered.length} matching contact${filtered.length === 1 ? "" : "s"}`
    : `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`;

  return (
    <AppShell
      fullBleed
      statusBar={
          <ScreenHeader
          title="Contacts"
          onBack={() => navigate("/history")}
          backAriaLabel="Back to history"
          action={<div style={{ display: "flex", gap: "var(--space-2)" }}><IconButton label="Import or export contacts" title="Import or export contacts" onClick={() => setTransferring(true)} style={{ color: "var(--color-text-primary)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}><Download01Icon size={20} strokeWidth={1.5} aria-hidden="true" /></IconButton><IconButton label="Add contact" title="Add contact" onClick={openAdd} style={{ color: "var(--color-text-primary)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}><AddCircleIcon size={21} strokeWidth={1.5} aria-hidden="true" /></IconButton></div>}
        />
      }
      contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}
    >
      <main style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Input
            label="Search contacts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, address, note, or tag"
            containerStyle={{ width: "100%" }}
            style={{ fontFamily: "var(--font-sans)" }}
            leftElement={<Search01Icon size={18} strokeWidth={1.5} />}
          />
          <span aria-live="polite" style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{searchDescription}</span>
          {transferStatus && <span aria-live="polite" style={{ color: transferStatus.startsWith("Could not") || transferStatus.startsWith("No valid") ? "var(--color-status-error)" : "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{transferStatus}</span>}
        </div>

        {filtered.length === 0 ? (
          <EmptyState hasContacts={contacts.length > 0} onAdd={openAdd} />
        ) : (
          <section aria-label="Saved contacts" style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
            {filtered.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                highlighted={recentlySavedId === contact.id}
                onSend={() => navigate(`/send?to=${contact.identity}`)}
                onEdit={() => openEdit(contact)}
              />
            ))}
          </section>
        )}
      </main>

      <Sheet
        open={transferring}
        onClose={() => setTransferring(false)}
        title="Import or export"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button variant="secondary" size="md" onClick={importContacts}>Import JSON or CSV</Button>
          <Button variant="ghost" size="md" onClick={() => exportContacts("json")} disabled={contacts.length === 0}>Export JSON</Button>
          <Button variant="ghost" size="md" onClick={() => exportContacts("csv")} disabled={contacts.length === 0}>Export CSV</Button>
        </div>
      </Sheet>

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add contact"
        footer={<ContactFormActions formId="add-contact-form" submitLabel="Add contact" disabled={!formName.trim() || !formIdentity.trim()} onCancel={() => setAdding(false)} />}
      >
        <ContactForm
          formId="add-contact-form"
          name={formName}
          onName={setFormName}
          identity={formIdentity}
          onIdentity={(value) => { setFormIdentity(value); setIdentityError(""); }}
          note={formNote}
          onNote={setFormNote}
          tags={formTags}
          onTags={setFormTags}
          identityError={identityError}
          onSubmit={doAdd}
        />
      </Sheet>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit contact"
        footer={
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <ContactFormActions formId="edit-contact-form" submitLabel="Save changes" disabled={!formName.trim() || !formIdentity.trim()} onCancel={() => setEditing(null)} />
            {editing && <button type="button" onClick={() => { setDeleting(editing); setEditing(null); }} style={{ alignSelf: "center", padding: "var(--space-2)", border: "none", background: "transparent", color: "var(--color-status-error)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)" }}>Remove contact</button>}
          </div>
        }
      >
        <ContactForm
          formId="edit-contact-form"
          name={formName}
          onName={setFormName}
          identity={formIdentity}
          onIdentity={(value) => { setFormIdentity(value); setIdentityError(""); }}
          note={formNote}
          onNote={setFormNote}
          tags={formTags}
          onTags={setFormTags}
          identityError={identityError}
          onSubmit={doEdit}
        />
      </Sheet>

      <Sheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove contact"
        footer={<div style={{ display: "flex", gap: "var(--space-3)" }}><Button variant="ghost" size="md" style={{ flex: 1 }} onClick={() => setDeleting(null)}>Keep contact</Button><Button variant="danger" size="md" style={{ flex: 1 }} onClick={() => { if (deleting) removeContact(deleting.id); setDeleting(null); }}>Remove</Button></div>}
      >
        <p style={{ margin: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", lineHeight: 1.5 }}>
          Remove <strong style={{ color: "var(--color-text-primary)" }}>{deleting?.name}</strong> from your saved recipients? This does not affect activity already recorded in Glyph.
        </p>
      </Sheet>
    </AppShell>
  );
}
