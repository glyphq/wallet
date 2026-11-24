import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AppShell } from "@/layouts/app-shell";
import { Button } from "@/components/button";
import { ScreenHeader } from "@/components/screen-header";
import { PageFrame } from "@/components/page-header";
import { usePersistedStore } from "@/store/persisted";
import { isValidIdentity, newId } from "@/lib/crypto";
import { ContactForm, ContactFormActions } from "./contact-form";

function parseTags(raw: string): string[] {
  return raw.split(/[,\s]+/).map((tag) => tag.trim().replace(/^#+/, "").toLowerCase()).filter(Boolean);
}

export default function ContactEditorScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const contacts = usePersistedStore((s) => s.contacts);
  const addContact = usePersistedStore((s) => s.addContact);
  const updateContact = usePersistedStore((s) => s.updateContact);
  const removeContact = usePersistedStore((s) => s.removeContact);

  const contact = id ? contacts.find((candidate) => candidate.id === id) ?? null : null;
  const editing = Boolean(id);
  const fromSettings = searchParams.get("from") === "settings";
  const backTo = fromSettings ? "/settings/contacts" : "/contacts";
  const statusBar = <ScreenHeader title={editing ? "Edit contact" : "Add contact"} onBack={() => navigate(backTo)} backAriaLabel="Back to contacts" />;

  const [name, setName] = useState(contact?.name ?? "");
  const [identity, setIdentity] = useState(contact?.identity ?? "");
  const [note, setNote] = useState(contact?.note ?? "");
  const [tags, setTags] = useState((contact?.tags ?? []).join(", "));
  const [identityError, setIdentityError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function validateIdentity(value: string): boolean {
    if (!isValidIdentity(value)) {
      setIdentityError("Enter a valid Qubic address.");
      return false;
    }
    setIdentityError("");
    return true;
  }

  function save() {
    if (!name.trim() || !validateIdentity(identity.trim())) return;

    if (editing && contact) {
      updateContact(contact.id, {
        name: name.trim(),
        identity: identity.trim(),
        note: note.trim(),
        tags: parseTags(tags),
      });
      navigate(backTo, { replace: true, state: { savedContactId: contact.id } });
      return;
    }

    const contactId = newId();
    addContact({
      id: contactId,
      name: name.trim(),
      identity: identity.trim(),
      note: note.trim(),
      tags: parseTags(tags),
      addedAt: Date.now(),
      lastUsedAt: 0,
    });
    navigate(backTo, { replace: true, state: { savedContactId: contactId } });
  }

  function remove() {
    if (!contact) return;
    removeContact(contact.id);
    navigate(backTo, { replace: true });
  }

  if (editing && !contact) {
    return (
      <AppShell fullBleed statusBar={statusBar} contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
        <PageFrame
          actions={<Button variant="secondary" style={{ width: "100%" }} onClick={() => navigate(backTo, { replace: true })}>Back to contacts</Button>}
        >
          <div style={{ maxWidth: 420, margin: "auto", textAlign: "center" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Contact not found
            </span>
            <p style={{ margin: "var(--space-2) 0 0", color: "var(--color-text-secondary)", fontSize: "var(--text-body-compact)" }}>
              This contact may have already been removed.
            </p>
          </div>
        </PageFrame>
      </AppShell>
    );
  }

  return (
    <AppShell fullBleed statusBar={statusBar} contentStyle={{ padding: 0, display: "flex", flexDirection: "column" }}>
      <PageFrame
        actions={(
          <ContactFormActions
            formId="contact-editor-form"
            submitLabel={editing ? "Save changes" : "Add contact"}
            disabled={!name.trim() || !identity.trim()}
            onCancel={() => navigate(backTo)}
          />
        )}
      >
        <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <ContactForm
            formId="contact-editor-form"
            name={name}
            onName={setName}
            identity={identity}
            onIdentity={(value) => {
              setIdentity(value);
              setIdentityError("");
            }}
            note={note}
            onNote={setNote}
            tags={tags}
            onTags={setTags}
            identityError={identityError}
            onSubmit={save}
          />

          {editing ? (
            <section aria-label="Remove contact" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
              {confirmDelete ? (
                <>
                  <p style={{ margin: 0, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)" }}>
                    Remove <strong style={{ color: "var(--color-text-primary)" }}>{contact?.name}</strong> from saved recipients? Activity already recorded in Glyph is unaffected.
                  </p>
                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <Button variant="ghost" size="md" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>
                      Keep contact
                    </Button>
                    <Button variant="danger" size="md" style={{ flex: 1 }} onClick={remove}>
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="danger" size="md" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmDelete(true)}>
                  Remove contact
                </Button>
              )}
            </section>
          ) : null}
        </div>
      </PageFrame>
    </AppShell>
  );
}
