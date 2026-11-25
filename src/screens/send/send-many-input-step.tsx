import { useState } from "react";
import { AddCircleIcon, ArrowUpRight01Icon, ClipboardIcon, File01Icon } from "@/lib/icons";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";
import { TextButton } from "@/components/text-button";
import { Textarea } from "@/components/textarea";
import { IdentityPickerScreen } from "@/components/identity-picker";
import type { PreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import type { Contact } from "@/store/persisted";
import { parseRecipientImport, type ImportedRecipient } from "@/lib/recipient-import";
import {
  MAX_RECIPIENTS, sumRecipientAmounts, type Recipient,
} from "./send-many-recipients";
import { RecipientEditor, SectionLabel, SendManyShell, SendManySummary } from "./send-many-ui";

export interface SendManyInputStepProps {
  recipients: Recipient[];
  contacts: Contact[];
  accounts: { name: string; identity: string }[];
  price: number | undefined;
  quote: PreferredCurrencyQuote;
  balance: bigint | null;
  fee: bigint | null;
  totalAmount: bigint;
  formError: string;
  canOpenPicker: boolean;
  onFieldChange: (index: number, field: Partial<Recipient>) => void;
  onEnter: () => void;
  onAddRecipient: () => void;
  onRemoveRecipient: (index: number) => void;
  registerIdentityRef: (index: number, el: HTMLInputElement | null) => void;
  onApplyImported: (recipients: ImportedRecipient[]) => void;
  onReview: () => void;
  canReview: boolean;
}

/** Send-many entry step: recipient list, totals, and import actions. */
export function SendManyInputStep({
  recipients,
  contacts,
  accounts,
  price,
  quote,
  balance,
  fee,
  totalAmount,
  formError,
  canOpenPicker,
  onFieldChange,
  onEnter,
  onAddRecipient,
  onRemoveRecipient,
  registerIdentityRef,
  onApplyImported,
  onReview,
  canReview,
}: SendManyInputStepProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const remaining = balance !== null && fee !== null
    ? balance - sumRecipientAmounts(recipients) - fee
    : null;

  function applyImportedRecipients(next: ImportedRecipient[]) {
    if (next.length === 0) {
      setImportError("No valid recipients found");
      return;
    }
    onApplyImported(next.slice(0, MAX_RECIPIENTS));
    setImportOpen(false);
    setImportText("");
    setImportError("");
  }

  function openImportFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.json,text/csv,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      applyImportedRecipients(parseRecipientImport(await file.text()));
    };
    input.click();
  }

  if (pickerIndex !== null) {
    return (
      <IdentityPickerScreen
        title="Choose recipient"
        contacts={contacts}
        accounts={accounts}
        onSelect={(identity) => {
          onFieldChange(pickerIndex, { identity, identityError: "" });
          setPickerIndex(null);
        }}
        onClose={() => setPickerIndex(null)}
      />
    );
  }

  return (
    <SendManyShell footer={(
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {formError ? <span role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>{formError}</span> : null}
        <Button onClick={onReview} disabled={!canReview}>
          Review transfer
          <ArrowUpRight01Icon size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    )}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <SectionLabel>{recipients.length} / {MAX_RECIPIENTS} recipients</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <TextButton onClick={() => setImportOpen(true)} tone="muted">
              <ClipboardIcon size={12} /> Paste list
            </TextButton>
            <TextButton onClick={openImportFile} tone="muted">
              <File01Icon size={12} /> Import CSV
            </TextButton>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {recipients.map((recipient, index) => {
            const identity = recipient.identity.trim().toUpperCase();
            return (
              <RecipientEditor
                key={recipient.id}
                recipient={recipient}
                index={index}
                totalCount={recipients.length}
                matchedContact={contacts.find((contact) => contact.identity === identity)}
                canOpenPicker={canOpenPicker}
                price={price}
                quote={quote}
                onFieldChange={(field) => onFieldChange(index, field)}
                onEnter={onEnter}
                onPickContact={() => setPickerIndex(index)}
                onRemove={() => onRemoveRecipient(index)}
                registerIdentityRef={(el) => registerIdentityRef(index, el)}
              />
            );
          })}
        </div>

        {recipients.length < MAX_RECIPIENTS ? (
          <Button variant="secondary" size="md" onClick={onAddRecipient}>
            <AddCircleIcon size={14} aria-hidden="true" />
            Add recipient
          </Button>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", paddingTop: "var(--space-3)" }}>
          <SendManySummary
            totalAmount={totalAmount}
            fee={fee}
            remaining={remaining}
            price={price}
            quote={quote}
          />
        </div>
      </div>

      <Sheet
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportError("");
          setImportText("");
        }}
        title="Paste recipients"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", lineHeight: "var(--leading-body)", color: "var(--color-text-tertiary)" }}>
            CSV: address, amount, label. JSON arrays with address and amount.
          </p>
          <Textarea
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value);
              setImportError("");
            }}
            rows={6}
            placeholder={"address,amount,label\nABC...,1000,Treasury"}
            style={{ minHeight: 144 }}
          />
          {importError ? (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>{importError}</span>
          ) : null}
          <Button onClick={() => applyImportedRecipients(parseRecipientImport(importText))}>
            Import
          </Button>
        </div>
      </Sheet>
    </SendManyShell>
  );
}
