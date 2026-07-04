import { useState } from "react";
import { motion } from "motion/react";
import { stepMotion, gesture } from "@/lib/animations";
import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore, type Contact } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";
import { truncateId } from "@/lib/format";
import { Identicon } from "@/components/identicon";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import { AltArrowRight, TrashBinMinimalistic } from "@solar-icons/react";

export default function SettingsContactsScreen() {
  const contacts = usePersistedStore((s) => s.contacts);
  const addContact = usePersistedStore((s) => s.addContact);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const removeContact = usePersistedStore((s) => s.removeContact);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");

  const [formName, setFormName] = useState("");
  const [formIdentity, setFormIdentity] = useState("");
  const [formNote, setFormNote] = useState("");
  const [identityError, setIdentityError] = useState("");
  const [nameError, setNameError] = useState("");

  function openAdd() {
    setFormName(""); setFormIdentity(""); setFormNote("");
    setIdentityError(""); setNameError("");
    setEditing(null); setFormOpen(true);
  }

  function openEdit(contact: Contact) {
    setFormName(contact.name); setFormIdentity(contact.identity); setFormNote(contact.note);
    setIdentityError(""); setNameError("");
    setEditing(contact); setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false); setEditing(null);
  }

  function doSave() {
    let valid = true;
    if (!formName.trim()) { setNameError("Required"); valid = false; }
    if (!isValidIdentity(formIdentity.trim())) { setIdentityError("Must be 60 uppercase letters"); valid = false; }
    if (!valid) return;

    if (editing) {
      updateContact(editing.id, { name: formName.trim(), identity: formIdentity.trim(), note: formNote.trim() });
    } else {
      addContact({
        id: newId(), name: formName.trim(), identity: formIdentity.trim(),
        note: formNote.trim(), addedAt: Date.now(), lastUsedAt: 0,
      });
    }
    closeForm();
  }

  const filtered = contacts
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.identity.includes(search.toUpperCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppShell fullBleed contentStyle={{ padding: "var(--space-4)", paddingBottom: "calc(var(--space-4) + 76px)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <motion.div {...stepMotion} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SettingsPageHeader title="Contacts" />

        {/* Add / Edit form */}
        {formOpen && (
          <Card>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-text-disabled)", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
              {editing ? "Edit contact" : "New contact"}
            </span>
            <Input label="Name" value={formName} onChange={(e) => { setFormName(e.target.value); setNameError(""); }} placeholder="Alice" error={nameError} autoFocus />
            <Input label="Identity" value={formIdentity} onChange={(e) => { setFormIdentity(e.target.value); setIdentityError(""); }} placeholder="60 uppercase letters" error={identityError} />
            <Input label="Note" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Optional" />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={doSave} style={{ flex: 1 }}>{editing ? "Save" : "Add contact"}</Button>
              <button onClick={closeForm} style={{
                padding: "var(--space-3) var(--space-4)", background: "transparent",
                border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)",
                cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
                fontWeight: 500, color: "var(--color-text-secondary)",
              }}>
                Cancel
              </button>
            </div>
          </Card>
        )}

        {/* Search + add button */}
        {contacts.length > 0 && !formOpen && (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts..."
              style={{
                flex: 1, background: "transparent", border: "none",
                borderBottom: "1px solid var(--color-border-subtle)", borderRadius: 0,
                padding: "var(--space-2) 0", fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)", color: "var(--color-text-display)", outline: "none",
              }}
            />
            <motion.button {...gesture.pressSubtle} onClick={openAdd} style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              fontWeight: 500, color: "var(--color-accent)", padding: 0, flexShrink: 0,
            }}>
              + Add
            </motion.button>
          </div>
        )}

        {/* Contact list */}
        {filtered.length > 0 && (
          <Card>
            {filtered.map((contact, i) => (
              <div key={contact.id}>
                {i > 0 && <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />}
                <motion.button
                  {...gesture.pressSubtle}
                  onClick={() => openEdit(contact)}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-3)",
                    width: "100%", padding: "var(--space-3) 0", background: "none",
                    border: "none", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <Identicon seed={contact.identity} size={32} radius={6} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {contact.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", marginTop: 2 }}>
                      {truncateId(contact.identity, 10, 6)}
                    </div>
                    {contact.note && (
                      <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {contact.note}
                      </div>
                    )}
                  </div>
                  <AltArrowRight size={14} weight="Outline" style={{ color: "var(--color-text-disabled)", flexShrink: 0 }} />
                </motion.button>
              </div>
            ))}
          </Card>
        )}

        {/* Empty state */}
        {contacts.length === 0 && !formOpen && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: "var(--space-4)", padding: "var(--space-8) 0",
          }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-disabled)" }}>
              No contacts yet
            </span>
            <Button onClick={openAdd}>Add your first contact</Button>
          </div>
        )}

        {/* Delete (when editing) */}
        {editing && formOpen && (
          <motion.button
            {...gesture.pressSubtle}
            onClick={() => { removeContact(editing.id); closeForm(); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "var(--space-2)", width: "100%", padding: "var(--space-3)",
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: "var(--text-label)",
              fontWeight: 500, color: "var(--color-status-error)",
            }}
          >
            <TrashBinMinimalistic size={14} weight="Outline" />
            Delete contact
          </motion.button>
        )}
      </motion.div>
    </AppShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "var(--space-3)",
      background: "var(--color-bg-surface)", borderRadius: "var(--radius-card)",
      padding: "var(--space-4)",
    }}>
      {children}
    </div>
  );
}
