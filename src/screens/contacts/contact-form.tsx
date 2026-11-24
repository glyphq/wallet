import type { ReactNode } from "react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

interface ContactFormProps {
  formId: string;
  name: string;
  onName: (value: string) => void;
  identity: string;
  onIdentity: (value: string) => void;
  tags: string;
  onTags: (value: string) => void;
  identityError: string;
  onSubmit: () => void;
}

export function ContactForm({ formId, name, onName, identity, onIdentity, tags, onTags, identityError, onSubmit }: ContactFormProps) {
  return (
    <form id={formId} onSubmit={(event) => { event.preventDefault(); onSubmit(); }} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Input label="Name" value={name} onChange={(event) => onName(event.target.value)} placeholder="e.g. Alice" autoFocus autoComplete="name" maxLength={80} />
      <Input label="Qubic address" value={identity} onChange={(event) => onIdentity(event.target.value)} error={identityError} placeholder="60 uppercase letters" technical autoCapitalize="characters" autoCorrect="off" maxLength={60} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <Input label="Tags" value={tags} onChange={(event) => onTags(event.target.value)} placeholder="friend, exchange, work" maxLength={160} />
        <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-caption)" }}>Optional. Separate tags with commas.</span>
      </div>
    </form>
  );
}

export function ContactFormActions({ formId, submitLabel, submitIcon, disabled }: { formId: string; submitLabel: string; submitIcon?: ReactNode; disabled: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Button type="submit" form={formId} size="md" style={{ width: "100%" }} disabled={disabled}>
        {submitIcon}
        {submitLabel}
      </Button>
    </div>
  );
}
