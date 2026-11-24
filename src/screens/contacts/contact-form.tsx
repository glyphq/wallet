import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";

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

export function ContactForm({ formId, name, onName, identity, onIdentity, note, onNote, tags, onTags, identityError, onSubmit }: ContactFormProps) {
  return (
    <form id={formId} onSubmit={(event) => { event.preventDefault(); onSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: "var(--text-label)", lineHeight: 1.5 }}>Use a clear name and verify the address before saving. You can add private notes and tags to help organize recipients.</p>
      <Input label="Name" value={name} onChange={(event) => onName(event.target.value)} placeholder="e.g. Alice" autoFocus autoComplete="name" maxLength={80} />
      <Input label="Qubic address" value={identity} onChange={(event) => onIdentity(event.target.value)} error={identityError} placeholder="60 uppercase letters" technical autoCapitalize="characters" autoCorrect="off" maxLength={60} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <Input label="Tags" value={tags} onChange={(event) => onTags(event.target.value)} placeholder="friend, exchange, work" maxLength={160} />
        <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-caption)" }}>Optional. Separate tags with commas.</span>
      </div>
      <Textarea label="Private note" value={note} onChange={(event) => onNote(event.target.value)} placeholder="Optional context that stays in Glyph" rows={3} maxLength={500} style={{ minHeight: 96 }} />
    </form>
  );
}

export function ContactFormActions({ formId, submitLabel, disabled, onCancel }: { formId: string; submitLabel: string; disabled: boolean; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)" }}>
      <Button type="button" variant="ghost" size="md" style={{ flex: 1 }} onClick={onCancel}>Cancel</Button>
      <Button type="submit" form={formId} size="md" style={{ flex: 1 }} disabled={disabled}>{submitLabel}</Button>
    </div>
  );
}
