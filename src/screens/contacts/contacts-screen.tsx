import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { AddCircle, ArrowRightUp, Download, Magnifier, PenNewSquare, Upload, UsersGroupRounded } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { ScreenHeader } from "@/components/screen-header";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Sheet } from "@/components/sheet";
import { Identicon } from "@/components/identicon";
import { usePersistedStore, type Contact } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";
import { truncateId } from "@/lib/format";

export default function ContactsScreen() {
  const navigate = useNavigate();
  const contacts = usePersistedStore((state) => state.contacts);
  const addContact = usePersistedStore((state) => state.addContact);
  const updateContact = usePersistedStore((state) => state.updateContact);
  const removeContact = usePersistedStore((state) => state.removeContact);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
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
      setIdentityError("Enter a valid Qubic identity.");
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
    const path = await save({
      defaultPath: `glyph-contacts.${format}`,
      filters: [{ name: format === "json" ? "JSON" : "CSV", extensions: [format] }],
    });
    if (!path) return;
    const content = format === "json" ? contactsToJson(contacts) : contactsToCsv(contacts);
    await writeTextFile(path, content);
    setTransferStatus(`Exported ${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`);
  }

  async function importContacts() {
    setTransferStatus("");
    const path = await open({
      multiple: false,
      filters: [{ name: "Contacts", extensions: ["json", "csv"] }],
    });
    if (!path || Array.isArray(path)) return;
    try {
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
    } catch (err) {
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
          action={<div style={{ display: "flex", gap: "var(--space-2)" }}><IconButton label="Import contacts" title="Import contacts" onClick={importContacts} style={{ color: "var(--color-text-primary)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}><Upload size={20} weight="Linear" aria-hidden="true" /></IconButton><IconButton label="Export contacts as JSON" title="Export contacts as JSON" onClick={() => exportContacts("json")} disabled={contacts.length === 0} style={{ color: "var(--color-text-primary)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}><Download size={20} weight="Linear" aria-hidden="true" /></IconButton><IconButton label="Add contact" title="Add contact" onClick={openAdd} style={{ color: "var(--color-text-primary)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}><AddCircle size={21} weight="Linear" aria-hidden="true" /></IconButton></div>}
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
            placeholder="Name, identity, note, or tag"
            containerStyle={{ width: "100%" }}
            style={{ fontFamily: "var(--font-sans)" }}
            leftElement={<Magnifier size={18} weight="Linear" />}
          />
          <span aria-live="polite" style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{searchDescription}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 22 }}>
            <button type="button" onClick={() => exportContacts("csv")} disabled={contacts.length === 0} style={{ padding: 0, border: "none", background: "transparent", color: contacts.length === 0 ? "var(--color-text-disabled)" : "var(--color-accent)", cursor: contacts.length === 0 ? "default" : "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)" }}>CSV export</button>
            {transferStatus && <span aria-live="polite" style={{ color: transferStatus.startsWith("Could not") || transferStatus.startsWith("No valid") ? "var(--color-status-error)" : "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{transferStatus}</span>}
          </div>
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

function ContactRow({ contact, highlighted, onSend, onEdit }: { contact: Contact; highlighted: boolean; onSend: () => void; onEdit: () => void }) {
  return (
    <article className={highlighted ? "flash-success" : undefined} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", padding: "var(--space-4) 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", minWidth: 0, flex: "1 1 180px" }}>
        <Identicon kind="identity" seed={contact.identity} label={contact.name} size={40} radius={10} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>{contact.name}</strong>
          <span style={{ display: "block", marginTop: 2, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.03em" }}>{truncateId(contact.identity)}</span>
          {contact.note && <span style={{ display: "block", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{contact.note}</span>}
          {(contact.tags ?? []).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>{(contact.tags ?? []).map((tag) => <span key={tag} style={{ padding: "2px var(--space-2)", border: "1px solid var(--color-accent)", borderRadius: "var(--radius-pill)", color: "var(--color-accent)", fontSize: "var(--text-caption)", lineHeight: 1.2 }}>#{tag}</span>)}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
        <Button variant="ghost" size="sm" onClick={onEdit}><PenNewSquare size={16} weight="Linear" aria-hidden="true" />Edit</Button>
        <Button variant="secondary" size="sm" onClick={onSend}>Send<ArrowRightUp size={16} weight="Bold" aria-hidden="true" /></Button>
      </div>
    </article>
  );
}

function EmptyState({ hasContacts, onAdd }: { hasContacts: boolean; onAdd: () => void }) {
  return (
    <section style={{ minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
      <UsersGroupRounded size={38} weight="Linear" aria-hidden="true" style={{ color: "var(--color-text-disabled)" }} />
      <strong style={{ color: "var(--color-text-primary)", fontSize: "var(--text-body)", fontWeight: 600 }}>{hasContacts ? "No contacts found" : "No contacts yet"}</strong>
      <span style={{ maxWidth: 300, color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.5 }}>{hasContacts ? "Try a name, identity, note, or tag." : "Save trusted recipients so sending stays quick and accurate."}</span>
      {!hasContacts && <IconButton label="Add your first contact" title="Add your first contact" onClick={onAdd} style={{ marginTop: "var(--space-2)", width: 44, height: 44, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}><AddCircle size={22} weight="Linear" aria-hidden="true" /></IconButton>}
    </section>
  );
}

function contactsToJson(contacts: Contact[]): string {
  return `${JSON.stringify({ version: 1, contacts: contacts.map(portableContact) }, null, 2)}\n`;
}

function contactsToCsv(contacts: Contact[]): string {
  const rows = [["name", "identity", "note", "tags"], ...contacts.map((contact) => [contact.name, contact.identity, contact.note, (contact.tags ?? []).join(" ")])];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function parseContactImport(raw: string, path: string): Contact[] {
  const contacts = path.toLowerCase().endsWith(".csv") ? parseContactsCsv(raw) : parseContactsJson(raw);
  const seen = new Set<string>();
  const valid = contacts.map(normalizeImportedContact).filter((contact): contact is Contact => {
    if (!contact || seen.has(contact.identity)) return false;
    seen.add(contact.identity);
    return true;
  });
  if (valid.length === 0) throw new Error("No valid contacts found.");
  return valid;
}

function parseContactsJson(raw: string): unknown[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { contacts?: unknown }).contacts)) return (parsed as { contacts: unknown[] }).contacts;
  throw new Error("Could not import contacts from this JSON file.");
}

function parseContactsCsv(raw: string): unknown[] {
  const rows = parseCsvRows(raw).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function normalizeImportedContact(value: unknown): Contact | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
  const identity = typeof record.identity === "string" ? record.identity.trim() : "";
  if (!name || !isValidIdentity(identity)) return null;
  const note = typeof record.note === "string" ? record.note.trim().slice(0, 500) : "";
  const tags: string[] = Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : typeof record.tags === "string" ? record.tags.split(/[\s,]+/) : [];
  return { id: newId(), name, identity, note, tags: tags.map((tag) => tag.trim().replace(/^#+/, "").toLowerCase()).filter(Boolean).slice(0, 20), addedAt: Date.now(), lastUsedAt: 0 };
}

function portableContact(contact: Contact) {
  return { name: contact.name, identity: contact.identity, note: contact.note, tags: contact.tags ?? [] };
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quoted) {
      if (char === '"' && raw[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

interface ContactFormProps {
  formId: string;
  name: string;
  onName: (value: string) => void;
  identity: string;
  onIdentity: (value: string) => void;
  note: string;
  onNote: (value: string) => void;
  tags: string;
  onTags: (value: string) => void;
  identityError: string;
  onSubmit: () => void;
}

function ContactForm({ formId, name, onName, identity, onIdentity, note, onNote, tags, onTags, identityError, onSubmit }: ContactFormProps) {
  return (
    <form id={formId} onSubmit={(event) => { event.preventDefault(); onSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.5 }}>Use a clear name and verify the identity before saving. You can add private notes and tags to help organize recipients.</p>
      <Input label="Name" value={name} onChange={(event) => onName(event.target.value)} placeholder="e.g. Alice" autoFocus autoComplete="name" maxLength={80} />
      <Input label="Qubic identity" value={identity} onChange={(event) => onIdentity(event.target.value)} error={identityError} placeholder="60 uppercase letters" technical autoCapitalize="characters" autoCorrect="off" maxLength={60} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <Input label="Tags" value={tags} onChange={(event) => onTags(event.target.value)} placeholder="friend, exchange, work" maxLength={160} />
        <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-caption)" }}>Optional. Separate tags with commas.</span>
      </div>
      <Textarea label="Private note" value={note} onChange={(event) => onNote(event.target.value)} placeholder="Optional context that stays in Glyph" rows={3} maxLength={500} style={{ minHeight: 96 }} />
    </form>
  );
}

function ContactFormActions({ formId, submitLabel, disabled, onCancel }: { formId: string; submitLabel: string; disabled: boolean; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)" }}>
      <Button type="button" variant="ghost" size="md" style={{ flex: 1 }} onClick={onCancel}>Cancel</Button>
      <Button type="submit" form={formId} size="md" style={{ flex: 1 }} disabled={disabled}>{submitLabel}</Button>
    </div>
  );
}
