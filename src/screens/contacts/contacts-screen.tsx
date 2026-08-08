import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { UsersGroupRounded } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { Sheet } from "@/components/sheet";
import { Identicon } from "@/components/identicon";
import { usePersistedStore, type Contact } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";
import { truncateId, timeAgo } from "@/lib/format";

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
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", overflow: "auto" }}>
      <main style={{ width: "min(100%, 760px)", margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-4)", paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <div>
            <h1 style={{ margin: 0, color: "var(--color-text-primary)", fontFamily: "var(--font-display)", fontSize: "var(--text-section)", letterSpacing: "-0.02em" }}>Contacts</h1>
            <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-label)" }}>Trusted recipients for faster sends.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={openAdd} style={{ flexShrink: 0 }}>Add contact</Button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Input
            label="Search contacts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, identity, note, or tag"
            containerStyle={{ width: "100%" }}
            style={{ fontFamily: "var(--font-sans)" }}
          />
          <span aria-live="polite" style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{searchDescription}</span>
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
        <Identicon kind="contact" seed={contact.identity} label={contact.name} size={40} radius={10} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 600 }}>{contact.name}</strong>
          <span style={{ display: "block", marginTop: 2, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", letterSpacing: "0.03em" }}>{truncateId(contact.identity)}</span>
          {(contact.note || contact.lastUsedAt) && <span style={{ display: "block", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-secondary)", fontSize: "var(--text-caption)" }}>{contact.note || `Last used ${timeAgo(contact.lastUsedAt)}`}</span>}
          {(contact.tags ?? []).length > 0 && <span style={{ display: "block", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-disabled)", fontSize: "var(--text-caption)" }}>{(contact.tags ?? []).map((tag) => `#${tag}`).join(" · ")}</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="secondary" size="sm" onClick={onSend}>Send</Button>
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
      {!hasContacts && <Button variant="secondary" size="sm" onClick={onAdd} style={{ marginTop: "var(--space-2)", width: "auto" }}>Add your first contact</Button>}
    </section>
  );
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
