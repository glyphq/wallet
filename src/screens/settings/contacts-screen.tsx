import { useState } from "react";
import { motion } from "framer-motion";

import { AppShell } from "@/layouts/app-shell";
import { SettingsPageHeader } from "@/components/settings-page-header";
import { usePersistedStore, type Contact } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";
import { truncateId } from "@/lib/format";
import { Identicon } from "@/components/identicon";

export default function SettingsContactsScreen() {
  const contacts = usePersistedStore((s) => s.contacts);
  const addContact = usePersistedStore((s) => s.addContact);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const removeContact = usePersistedStore((s) => s.removeContact);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");

  const [formName, setFormName] = useState("");
  const [formIdentity, setFormIdentity] = useState("");
  const [formNote, setFormNote] = useState("");
  const [identityError, setIdentityError] = useState("");

  function openAdd() {
    setFormName("");
    setFormIdentity("");
    setFormNote("");
    setIdentityError("");
    setAdding(true);
    setEditing(null);
  }

  function openEdit(contact: Contact) {
    setFormName(contact.name);
    setFormIdentity(contact.identity);
    setFormNote(contact.note);
    setIdentityError("");
    setEditing(contact);
    setAdding(false);
  }

  function closeForm() {
    setAdding(false);
    setEditing(null);
    setIdentityError("");
  }

  function validateIdentity(id: string): boolean {
    if (!isValidIdentity(id)) {
      setIdentityError("Must be 60 uppercase letters");
      return false;
    }
    setIdentityError("");
    return true;
  }

  function doSave() {
    if (!formName.trim() || !validateIdentity(formIdentity.trim())) return;
    if (editing) {
      updateContact(editing.id, {
        name: formName.trim(),
        identity: formIdentity.trim(),
        note: formNote.trim(),
      });
    } else {
      addContact({
        id: newId(),
        name: formName.trim(),
        identity: formIdentity.trim(),
        note: formNote.trim(),
        addedAt: Date.now(),
        lastUsedAt: 0,
      });
    }
    closeForm();
  }

  const filtered = contacts
    .filter(
      (c) =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.identity.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const showForm = adding || editing !== null;

  return (
    <AppShell
      fullBleed
      contentStyle={{
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <motion.div
        initial={{ y: 4 }}
        animate={{ y: 0 }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
      >
        <SettingsPageHeader title="Contacts" />

        {/* Search and add */}
        {contacts.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or identity"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--color-border-strong)",
                borderRadius: 0,
                padding: "var(--space-2) 0",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                color: "var(--color-text-display)",
                outline: "none",
              }}
            />
            <button
              onClick={openAdd}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-small)",
                color: "var(--color-text-disabled)",
                padding: 0,
                flexShrink: 0,
              }}
            >
              + Add
            </button>
          </div>
        )}

        {/* Inline add/edit form */}
        {showForm && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              background: "var(--color-bg-surface)",
              borderRadius: "var(--radius-card)",
              padding: "var(--space-4)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                color: "var(--color-text-primary)",
              }}
            >
              {editing ? "Edit contact" : "Add contact"}
            </div>

            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Name"
              autoFocus
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--color-border-subtle)",
                borderRadius: 0,
                padding: "var(--space-2) 0",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                color: "var(--color-text-primary)",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />

            <div>
              <input
                value={formIdentity}
                onChange={(e) => {
                  setFormIdentity(e.target.value);
                  setIdentityError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && doSave()}
                placeholder="Identity (60 uppercase letters)"
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: identityError
                    ? "1px solid var(--color-status-error)"
                    : "1px solid var(--color-border-subtle)",
                  borderRadius: 0,
                  padding: "var(--space-2) 0",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              {identityError && (
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-small)",
                    color: "var(--color-status-error)",
                    marginTop: "var(--space-1)",
                  }}
                >
                  {identityError}
                </div>
              )}
            </div>

            <input
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Note (optional)"
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--color-border-subtle)",
                borderRadius: 0,
                padding: "var(--space-2) 0",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-body)",
                color: "var(--color-text-primary)",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
              <button
                onClick={doSave}
                disabled={!formName.trim() || !formIdentity.trim()}
                style={{
                  flex: 1,
                  padding: "var(--space-3)",
                  border: "none",
                  cursor: !formName.trim() || !formIdentity.trim() ? "default" : "pointer",
                  opacity: !formName.trim() || !formIdentity.trim() ? 0.4 : 1,
                  borderRadius: "var(--radius-sharp)",
                  background: "var(--color-text-primary)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  fontWeight: 500,
                  color: "var(--color-bg-base)",
                }}
              >
                Save
              </button>
              <button
                onClick={closeForm}
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--color-bg-elevated)",
                  border: "none",
                  borderRadius: "var(--radius-sharp)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-label)",
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {contacts.length === 0 && !showForm && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--color-text-disabled)",
              textAlign: "center",
            }}
          >
            No contacts yet
          </div>
        )}

        {contacts.length > 0 && filtered.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body)",
              color: "var(--color-text-disabled)",
              textAlign: "center",
            }}
          >
            No results
          </div>
        )}

        {/* Add button when list exists and no form open */}
        {contacts.length === 0 && !showForm && (
          <button
            onClick={openAdd}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-small)",
              color: "var(--color-text-disabled)",
              padding: 0,
              textAlign: "center",
            }}
          >
            + Add contact
          </button>
        )}

        {/* Contact list */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((contact, i) => (
            <>
              {i > 0 && <div style={{ height: 1, background: "var(--color-border-subtle)" }} />}
              <div
                key={contact.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) 0",
                }}
              >
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                <Identicon
                  seed={contact.identity}
                  size={32}
                  radius={5}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {contact.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-label)",
                      color: "var(--color-text-disabled)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    {truncateId(contact.identity)}
                  </div>
                  {contact.note && (
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "var(--text-small)",
                        color: "var(--color-text-secondary)",
                        marginTop: "var(--space-1)",
                      }}
                    >
                      {contact.note}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button
                  onClick={() => openEdit(contact)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    padding: 0,
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => removeContact(contact.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 500,
                    color: "var(--color-status-error)",
                    padding: 0,
                  }}
                >
                  Delete
                </button>
              </div>
              </div>
            </>
          ))}
        </div>
      </motion.div>
    </AppShell>
  );
}
