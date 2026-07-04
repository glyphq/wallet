import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UsersGroupRounded } from "@solar-icons/react";
import { AppShell } from "@/layouts/app-shell";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Sheet } from "@/components/sheet";
import { usePersistedStore, type Contact } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";
import { truncateId } from "@/lib/format";
import { Identicon } from "@/components/identicon";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function ContactsScreen() {
  const navigate = useNavigate();

  const contacts = usePersistedStore((s) => s.contacts);
  const addContact = usePersistedStore((s) => s.addContact);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const removeContact = usePersistedStore((s) => s.removeContact);

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
    return raw.split(/[,\s]+/).map((t) => t.trim().replace(/^#+/, "").toLowerCase()).filter(Boolean);
  }

  function openAdd() {
    setFormName(""); setFormIdentity(""); setFormNote(""); setFormTags(""); setIdentityError("");
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

  function validateIdentity(id: string): boolean {
    if (!isValidIdentity(id)) { setIdentityError("Invalid identity"); return false; }
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
    updateContact(editing.id, { name: formName.trim(), identity: formIdentity.trim(), note: formNote.trim(), tags: parseTags(formTags) });
    setRecentlySavedId(editing.id);
    setEditing(null);
  }

  const filtered = useMemo(() =>
    contacts
      .filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.identity.toLowerCase().includes(q) ||
          (c.tags ?? []).some((t) => t.includes(q))
        );
      })
      .sort((a, b) => {
        if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        return a.name.localeCompare(b.name);
      }),
    [contacts, search],
  );

  const statusBar = (
    <ScreenHeader
      title="Contacts"
      onBack={() => navigate("/dashboard")}
      action={<button type="button" onClick={openAdd} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-secondary)", padding: 0 }}>+ Add</button>}
    />
  );

  return (
    <AppShell statusBar={statusBar} contentStyle={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or identity"
        style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)" }}
      />

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "var(--space-12) 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}>
          <UsersGroupRounded size={48} weight="Linear" style={{ color: "var(--color-text-disabled)", opacity: 0.5 }} />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
            {contacts.length === 0 ? "No contacts yet" : "No results"}
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", opacity: 0.7 }}>
            {contacts.length === 0 ? "Add contacts to quickly send to people you know" : "Try a different search term"}
          </div>
          {contacts.length === 0 && (
            <Button variant="secondary" shape="sharp" size="sm" style={{ width: "auto" }} onClick={openAdd}>
              Add your first contact
            </Button>
          )}
        </div>
      )}

      {filtered.map((contact) => (
        <div key={contact.id} className={`stagger-item${recentlySavedId === contact.id ? " flash-success" : ""}`}>
          <div style={{ background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)", padding: "var(--space-4)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
            <button
              onClick={() => navigate(`/send?to=${contact.identity}`)}
              style={{ flex: 1, display: "flex", gap: "var(--space-3)", alignItems: "flex-start", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
            >
              <Identicon seed={contact.identity} size={36} radius={6} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-display)", marginBottom: 2 }}>
                  {contact.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.05em" }}>
                    {truncateId(contact.identity)}
                  </span>
                  {contact.lastUsedAt ? (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)", letterSpacing: "0.05em" }}>
                      {timeAgo(contact.lastUsedAt)}
                    </span>
                  ) : null}
                </div>
                {(contact.tags ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", marginTop: 2 }}>
                    {(contact.tags ?? []).map((tag) => (
                      <span key={tag} style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>#{tag}</span>
                    ))}
                  </div>
                )}
                {contact.note && (
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: 2 }}>
                    {contact.note}
                  </div>
                )}
              </div>
            </button>
            <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
              <Button variant="ghost" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => openEdit(contact)}>Edit</Button>
              <Button variant="danger" shape="sharp" size="sm" style={{ width: "auto" }} onClick={() => setDeleting(contact)}>Remove</Button>
            </div>
          </div>
        </div>
      ))}

      {/* Add contact sheet */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add contact">
        <ContactForm
          name={formName} onName={setFormName}
          identity={formIdentity} onIdentity={(v) => { setFormIdentity(v); setIdentityError(""); }}
          note={formNote} onNote={setFormNote}
          tags={formTags} onTags={setFormTags}
          identityError={identityError}
          onSubmit={doAdd}
          onCancel={() => setAdding(false)}
          submitLabel="Add contact"
        />
      </Sheet>

      {/* Edit contact sheet */}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit contact">
        <ContactForm
          name={formName} onName={setFormName}
          identity={formIdentity} onIdentity={(v) => { setFormIdentity(v); setIdentityError(""); }}
          note={formNote} onNote={setFormNote}
          tags={formTags} onTags={setFormTags}
          identityError={identityError}
          onSubmit={doEdit}
          onCancel={() => setEditing(null)}
          submitLabel="Save"
        />
      </Sheet>

      {/* Delete contact sheet */}
      <Sheet open={!!deleting} onClose={() => setDeleting(null)} title={deleting ? `Remove ${deleting.name}?` : "Remove contact?"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Button variant="danger" shape="sharp" onClick={() => { if (deleting) { removeContact(deleting.id); setDeleting(null); } }}>Remove</Button>
          <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={() => setDeleting(null)}>Cancel</Button>
        </div>
      </Sheet>
    </AppShell>
  );
}

interface ContactFormProps {
  name: string; onName: (v: string) => void;
  identity: string; onIdentity: (v: string) => void;
  note: string; onNote: (v: string) => void;
  tags: string; onTags: (v: string) => void;
  identityError: string;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

function ContactForm({ name, onName, identity, onIdentity, note, onNote, tags, onTags, identityError, onSubmit, onCancel, submitLabel }: ContactFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Input label="Name" value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Alice" autoFocus style={{ fontFamily: "var(--font-sans)" }} />
      <Input label="Identity" value={identity} onChange={(e) => onIdentity(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSubmit()} error={identityError} placeholder="60 uppercase letters" />
      <Input label="Tags (optional)" value={tags} onChange={(e) => onTags(e.target.value)} placeholder="exchange, friend, dao" style={{ fontFamily: "var(--font-sans)" }} />
      <Input label="Note (optional)" value={note} onChange={(e) => onNote(e.target.value)} placeholder="e.g. Friend, exchange" style={{ fontFamily: "var(--font-sans)" }} />
      <Button onClick={onSubmit} disabled={!name.trim() || !identity.trim()}>{submitLabel}</Button>
      <Button variant="ghost" shape="sharp" size="md" style={{ width: "auto", margin: "0 auto" }} onClick={onCancel}>Cancel</Button>
    </div>
  );
}
