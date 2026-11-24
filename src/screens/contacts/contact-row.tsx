import { Edit02Icon, SentIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { Identicon } from "@/components/identicon";
import type { Contact } from "@/store/persisted";
import { truncateId } from "@/lib/format";

export function ContactRow({ contact, onSend, onEdit }: { contact: Contact; onSend: () => void; onEdit: () => void }) {
  const tags = contact.tags ?? [];

  return (
    <article className="contact-row">
      <div className="contact-row-identity">
        <Identicon kind="identity" seed={contact.identity} label={contact.name} size={36} style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <strong className="contact-row-name">{contact.name}</strong>
          <span className="contact-row-address">{truncateId(contact.identity)}</span>
          {tags.length > 0 ? (
            <span className="contact-row-tags">{tags.map((tag) => `#${tag}`).join("  ")}</span>
          ) : null}
        </div>
      </div>
      <div className="contact-row-actions">
        <IconButton label={`Edit ${contact.name}`} title="Edit contact" onClick={onEdit}>
          <Edit02Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        </IconButton>
        <IconButton label={`Send to ${contact.name}`} title="Send" onClick={onSend} style={{ color: "var(--color-accent)" }}>
          <SentIcon size={17} strokeWidth={1.5} aria-hidden="true" />
        </IconButton>
      </div>
    </article>
  );
}

export function EmptyState({ hasContacts, onAdd }: { hasContacts: boolean; onAdd: () => void }) {
  return (
    <section className="contacts-empty corner-frame">
      <span className="contacts-empty-label">
        {hasContacts ? "No matches" : "No contacts"}
      </span>
      <strong style={{ color: "var(--color-text-primary)", fontSize: "var(--text-title)", fontWeight: 400, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>
        {hasContacts ? "Nothing found." : "Build your address book."}
      </strong>
      <p style={{ margin: 0, maxWidth: 300, color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-body-compact)", lineHeight: "var(--leading-body)" }}>
        {hasContacts ? "Try a different name, address, note, or tag." : "Save trusted recipients so sending stays quick and accurate."}
      </p>
      {!hasContacts ? (
        <Button variant="secondary" size="md" style={{ width: "auto", marginTop: "var(--space-2)" }} onClick={onAdd}>
          Add contact
        </Button>
      ) : null}
    </section>
  );
}
