import { AddCircleIcon, ArrowUpRight01Icon, Edit02Icon, UserGroupIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { IconButton } from "@/components/icon-button";
import { Identicon } from "@/components/identicon";
import type { Contact } from "@/store/persisted";
import { truncateId } from "@/lib/format";

export function ContactRow({ contact, highlighted, onSend, onEdit }: { contact: Contact; highlighted: boolean; onSend: () => void; onEdit: () => void }) {
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
        <Button variant="ghost" size="sm" onClick={onEdit}><Edit02Icon size={16} strokeWidth={1.5} aria-hidden="true" />Edit</Button>
        <Button variant="secondary" size="sm" onClick={onSend}>Send<ArrowUpRight01Icon size={16} strokeWidth={2} aria-hidden="true" /></Button>
      </div>
    </article>
  );
}

export function EmptyState({ hasContacts, onAdd }: { hasContacts: boolean; onAdd: () => void }) {
  return (
    <section style={{ minHeight: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)", borderBottom: "1px solid var(--color-border-subtle)" }}>
      <UserGroupIcon size={38} strokeWidth={1.5} aria-hidden="true" style={{ color: "var(--color-text-disabled)" }} />
      <strong style={{ color: "var(--color-text-primary)", fontSize: "var(--text-body)", fontWeight: 600 }}>{hasContacts ? "No contacts found" : "No contacts yet"}</strong>
      <span style={{ maxWidth: 300, color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.5 }}>{hasContacts ? "Try a name, identity, note, or tag." : "Save trusted recipients so sending stays quick and accurate."}</span>
      {!hasContacts && <IconButton label="Add your first contact" title="Add your first contact" onClick={onAdd} style={{ marginTop: "var(--space-2)", width: 44, height: 44, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", borderColor: "var(--color-border-subtle)" }}><AddCircleIcon size={22} strokeWidth={1.5} aria-hidden="true" /></IconButton>}
    </section>
  );
}
