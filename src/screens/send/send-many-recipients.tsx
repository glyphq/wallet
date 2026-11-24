import { Delete02Icon, UserCircleIcon } from "@/lib/icons";
import { EmbeddedInput } from "@/components/embedded-input";
import { Sheet } from "@/components/sheet";
import type { PreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import { newId } from "@/lib/crypto";
import { formatPreferredCurrencyFromQu, truncateId } from "@/lib/format";
import type { AddressSuggestion } from "@/lib/address-intelligence";
import type { Contact } from "@/store/persisted";
import { normalizeIdentity, sumQuAmounts } from "./send-flow";
import { AddressSuggestionsOverlay } from "./send-ui";

export const MAX_RECIPIENTS = 25;

export interface Recipient {
  id: string;
  identity: string;
  amount: string;
  identityError: string;
  amountError: string;
}

export function emptyRecipient(): Recipient {
  return { id: newId(), identity: "", amount: "", identityError: "", amountError: "" };
}

/** Sum of all positive recipient amounts (unparsable entries ignored). */
export function sumRecipientAmounts(recipients: readonly Recipient[]): bigint {
  return sumQuAmounts(recipients.map((recipient) => recipient.amount));
}

export interface RecipientRowProps {
  recipient: Recipient;
  index: number;
  totalCount: number;
  matchedContact: Contact | undefined;
  suggestions: AddressSuggestion[];
  canOpenPicker: boolean;
  price: number | undefined;
  quote: PreferredCurrencyQuote;
  focused: boolean;
  onFieldChange: (field: Partial<Recipient>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onEnter: () => void;
  onPickContact: () => void;
  onRemove: () => void;
  onSelectSuggestion: (identity: string) => void;
  registerIdentityRef: (el: HTMLInputElement | null) => void;
}

/** One recipient card: identity, amount, errors, suggestions. */
export function RecipientRow({
  recipient,
  index,
  totalCount,
  matchedContact,
  suggestions,
  canOpenPicker,
  price,
  quote,
  focused,
  onFieldChange,
  onFocus,
  onBlur,
  onEnter,
  onPickContact,
  onRemove,
  onSelectSuggestion,
  registerIdentityRef,
}: RecipientRowProps) {
  const idUpper = normalizeIdentity(recipient.identity);

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        background: "var(--color-bg-surface)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-3) var(--space-4)",
        display: "flex", flexDirection: "column", gap: "var(--space-3)",
      }}>
        {/* Identity row */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <UserCircleIcon size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)" }} />
          <EmbeddedInput
            ref={registerIdentityRef}
            autoComplete="off"
            value={recipient.identity}
            onChange={(e) => onFieldChange({ identity: e.target.value, identityError: "" })}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={(e) => e.key === "Enter" && onEnter()}
            placeholder={totalCount > 1 ? `Recipient ${index + 1}` : "Address or contact"}
            style={{ flex: 1 }}
          />
          {canOpenPicker && (
            <button onClick={onPickContact}
              style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4, color: "var(--color-text-disabled)", display: "flex" }}>
              <UserCircleIcon size={16} />
            </button>
          )}
          {totalCount > 1 && (
            <button onClick={onRemove}
              style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4, color: "var(--color-text-disabled)", display: "flex" }}>
              <Delete02Icon size={16} />
            </button>
          )}
        </div>

        {/* Amount row */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-disabled)", flexShrink: 0, width: 20, textAlign: "center" }}>QU</span>
          <EmbeddedInput
            autoComplete="off"
            value={recipient.amount}
            onChange={(e) => onFieldChange({ amount: e.target.value.replace(/[^0-9]/g, ""), amountError: "" })}
            onKeyDown={(e) => e.key === "Enter" && onEnter()}
            placeholder="Amount"
            inputMode="numeric"
            technical
            style={{ flex: 1 }}
          />
          {price && recipient.amount && Number(recipient.amount) > 0 && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)", flexShrink: 0 }}>
              {price ? formatPreferredCurrencyFromQu(recipient.amount, { usdPrice: price, ...quote }).text : null}
            </span>
          )}
        </div>

        {/* Errors */}
        {(recipient.identityError || recipient.amountError) && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-status-error)" }}>
            {recipient.identityError || recipient.amountError}
          </span>
        )}

        {/* Contact match */}
        {matchedContact && !recipient.identityError && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-accent)" }}>{matchedContact.name}</span>
        )}
      </div>

      {/* Suggestions overlay */}
      {focused && recipient.identity.trim() && (
        <AddressSuggestionsOverlay
          suggestions={suggestions}
          currentIdentity={idUpper}
          onSelect={onSelectSuggestion}
          maxHeight={200}
        />
      )}
    </div>
  );
}

/** Sheet listing contacts and wallet accounts for a recipient slot. */
export function RecipientPickerSheet({
  open,
  contacts,
  accounts,
  onClose,
  onSelect,
}: {
  open: boolean;
  contacts: Contact[];
  accounts: { name: string; identity: string }[];
  onClose: () => void;
  onSelect: (identity: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Pick recipient">
      {contacts.map((c) => (
        <button key={c.id} onClick={() => onSelect(c.identity)}
          style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: "var(--space-3) 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-display)" }}>{c.name}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{truncateId(c.identity)}</span>
        </button>
      ))}
      {accounts.map((a) => (
        <button key={a.identity} onClick={() => onSelect(a.identity)}
          style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", padding: "var(--space-3) 0", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border-subtle)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-body)", color: "var(--color-text-display)" }}>{a.name}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-disabled)" }}>{truncateId(a.identity)}</span>
        </button>
      ))}
    </Sheet>
  );
}
