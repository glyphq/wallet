import { useState } from "react";
import {
  AddCircleIcon, ArrowUpRight01Icon, ClipboardIcon, File01Icon, FlashIcon, Wallet01Icon,
} from "@/lib/icons";
import { Button } from "@/components/button";
import { DetailRow } from "@/components/detail-row";
import { Sheet } from "@/components/sheet";
import { TextButton } from "@/components/text-button";
import { Textarea } from "@/components/textarea";
import type { PreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { formatPreferredCurrencyFromQu, formatQu } from "@/lib/format";
import type { AddressSuggestion } from "@/lib/address-intelligence";
import type { Contact } from "@/store/persisted";
import { parseRecipientImport, type ImportedRecipient } from "@/lib/recipient-import";
import { SendStepPanel } from "./send-step-panel";
import { labelStyle } from "./send-ui";
import {
  MAX_RECIPIENTS, RecipientPickerSheet, RecipientRow, sumRecipientAmounts, type Recipient,
} from "./send-many-recipients";

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
  suggestionsByIndex: AddressSuggestion[][];
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

/** Send-many entry step: recipient list, totals, import and picker sheets. */
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
  suggestionsByIndex,
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
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const remaining = balance !== null && fee !== null
    ? balance - sumRecipientAmounts(recipients) - fee
    : null;
  const overBalance = remaining !== null && remaining < 0n;

  function applyImportedRecipients(next: ImportedRecipient[]) {
    if (next.length === 0) { setImportError("No valid recipients found"); return; }
    onApplyImported(next.slice(0, MAX_RECIPIENTS));
    setImportOpen(false); setImportText(""); setImportError("");
  }

  function importFromText() { applyImportedRecipients(parseRecipientImport(importText)); }

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

  return (
    <SendStepPanel scroll="auto" gap="var(--space-3)">
      {/* Import links */}
      <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-4)" }}>
        <TextButton onClick={() => setImportOpen(true)} tone="muted">
          <ClipboardIcon size={12} /> Paste list
        </TextButton>
        <TextButton onClick={openImportFile} tone="muted">
          <File01Icon size={12} /> Import CSV
        </TextButton>
      </div>

      {/* Recipient rows */}
      {recipients.map((r, i) => {
        const idUpper = r.identity.trim().toUpperCase();
        const matchedContact = contacts.find((c) => c.identity === idUpper);
        return (
          <RecipientRow
            key={r.id}
            recipient={r}
            index={i}
            totalCount={recipients.length}
            matchedContact={matchedContact}
            suggestions={suggestionsByIndex[i]}
            canOpenPicker={canOpenPicker}
            price={price}
            quote={quote}
            focused={focusIndex === i}
            onFieldChange={(field) => onFieldChange(i, field)}
            onFocus={() => setFocusIndex(i)}
            onBlur={() => setTimeout(() => setFocusIndex(null), 150)}
            onEnter={onEnter}
            onPickContact={() => setPickerIndex(i)}
            onRemove={() => onRemoveRecipient(i)}
            onSelectSuggestion={(identity) => {
              onFieldChange(i, { identity, identityError: "" });
              setFocusIndex(null);
            }}
            registerIdentityRef={(el) => registerIdentityRef(i, el)}
          />
        );
      })}

      {/* Add recipient */}
      {recipients.length < MAX_RECIPIENTS && (
        <Button variant="secondary" size="md" onClick={onAddRecipient}>
          <AddCircleIcon size={14} /> Add recipient ({recipients.length}/{MAX_RECIPIENTS})
        </Button>
      )}

      {/* Summary card */}
      <div style={{
        background: "var(--color-bg-surface)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-1) var(--space-4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
          <ArrowUpRight01Icon size={16} style={{ color: "var(--color-text-disabled)" }} />
          <span style={{ ...labelStyle, flex: 1 }}>Total</span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: "var(--color-text-display)" }}>
              {formatQu(totalAmount)} QU
            </span>
            {price && totalAmount > 0n && (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
                {price ? formatPreferredCurrencyFromQu(totalAmount, { usdPrice: price, ...quote }).text : null}
              </div>
            )}
          </div>
        </div>
        {fee !== null && (
          <>
            <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
            <DetailRow icon={<FlashIcon size={16} />} label="QUtil fee" value={`${formatQu(fee)} QU`} mono={false} />
          </>
        )}
        {remaining !== null && (
          <>
            <div style={{ height: 1, background: "var(--color-border-subtle)", margin: "0 calc(-1 * var(--space-4))" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "11px 0" }}>
              <Wallet01Icon size={16} style={{ color: "var(--color-text-disabled)" }} />
              <span style={{ ...labelStyle, flex: 1 }}>Remaining</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-label)", color: overBalance ? "var(--color-status-error)" : "var(--color-text-secondary)" }}>
                {formatQu(remaining < 0n ? 0n : remaining)} QU
              </span>
            </div>
          </>
        )}
      </div>

      {formError && (
        <span style={{ ...labelStyle, color: "var(--color-status-error)", textAlign: "center" }}>{formError}</span>
      )}

      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{ paddingBottom: "var(--space-6)" }}>
        <Button onClick={onReview} disabled={!canReview}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
            Review <ArrowUpRight01Icon size={16} strokeWidth={2} />
          </span>
        </Button>
      </div>

      {/* Import sheet */}
      <Sheet open={importOpen} onClose={() => { setImportOpen(false); setImportError(""); setImportText(""); }} title="Paste recipients">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)" }}>
            CSV: identity, amount, label. JSON arrays with identity and amount.
          </div>
          <Textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportError(""); }}
            rows={6}
            placeholder={"identity,amount,label\nABC...,1000,Treasury"}
            style={{ minHeight: 144 }}
          />
          {importError && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-status-error)" }}>{importError}</span>
          )}
          <Button onClick={importFromText}>Import</Button>
        </div>
      </Sheet>

      {/* Contact picker sheet */}
      <RecipientPickerSheet
        open={pickerIndex !== null}
        contacts={contacts}
        accounts={accounts}
        onClose={() => setPickerIndex(null)}
        onSelect={(identity) => {
          if (pickerIndex !== null) onFieldChange(pickerIndex, { identity, identityError: "" });
          setPickerIndex(null);
        }}
      />
    </SendStepPanel>
  );
}
