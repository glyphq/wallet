import type { ReactNode, RefObject } from "react";
import { ArrowUpRight01Icon, UserCircleIcon, UserGroupIcon } from "@/lib/icons";
import { Button } from "@/components/button";
import { ContactPicker } from "@/components/contact-picker";
import { EmbeddedInput } from "@/components/embedded-input";
import { TextButton } from "@/components/text-button";
import { formatQu, type DisplayCurrency } from "@/lib/format";
import type { AddressSuggestion } from "@/lib/address-intelligence";
import type { Contact } from "@/store/persisted";
import { SendStepPanel } from "./send-step-panel";
import { AddressSuggestionsOverlay, Numpad, labelStyle } from "./send-ui";

export interface SendInputStepProps {
  statusBar: ReactNode;
  accountName: string;
  draftRestored: boolean;
  onDismissDraft: () => void;
  amountStr: string;
  usdMode: boolean;
  usdStr: string;
  amountError: string;
  fiatEquiv: string | null;
  displayCurrency: DisplayCurrency;
  onToggleCurrency: () => void;
  onNumpad: (key: string) => void;
  onMax: (() => void) | undefined;
  balance: bigint | null;
  destination: string;
  destUpper: string;
  destError: string;
  destRef: RefObject<HTMLInputElement | null>;
  matchedContactName: string | null;
  canOpenPicker: boolean;
  suggestions: AddressSuggestion[];
  onChangeDestination: (value: string) => void;
  onSelectDestination: (identity: string) => void;
  onPickerSelect: (identity: string) => void;
  onReview: () => void;
  canReview: boolean;
  contacts: Contact[];
  accounts: { name: string; identity: string }[];
  showPicker: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
}

/** Send entry step: numpad amount, recipient field, suggestions, pickers. */
export function SendInputStep({
  statusBar,
  accountName,
  draftRestored,
  onDismissDraft,
  amountStr,
  usdMode,
  usdStr,
  amountError,
  fiatEquiv,
  displayCurrency,
  onToggleCurrency,
  onNumpad,
  onMax,
  balance,
  destination,
  destUpper,
  destError,
  destRef,
  matchedContactName,
  canOpenPicker,
  suggestions,
  onChangeDestination,
  onSelectDestination,
  onPickerSelect,
  onReview,
  canReview,
  contacts,
  accounts,
  showPicker,
  onOpenPicker,
  onClosePicker,
}: SendInputStepProps) {
  return (
    <SendStepPanel minHeight="min-content" scroll="y" statusBar={statusBar}>
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-3)" }}>
        <span style={{ ...labelStyle, color: "var(--color-text-tertiary)" }}>From {accountName}</span>
      </div>

      {/* Amount display */}
      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "var(--space-8)", paddingBottom: "var(--space-2)", gap: "var(--space-1)", position: "relative", overflow: "hidden", width: "100%" }}>

        {/* Draft notice */}
        {draftRestored && (
          <div style={{ position: "absolute", top: "var(--space-3)", padding: "var(--space-1) var(--space-3)", background: "var(--color-status-warning-soft)", borderRadius: "var(--radius-pill)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ ...labelStyle, color: "var(--color-status-warning)", fontSize: "var(--text-label)" }}>Draft restored</span>
            <button type="button" onClick={onDismissDraft} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-status-warning)", fontSize: "0.625rem", padding: 0 }}>✕</button>
          </div>
        )}

        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: (() => {
            const raw = usdMode ? usdStr : amountStr;
            if (!raw) return "var(--text-display)";
            const len = raw.length + (usdMode ? 1 : 0); // +1 for $
            if (len <= 6) return "3.5rem";
            if (len <= 9) return "2.75rem";
            if (len <= 12) return "2.125rem";
            return "1.75rem";
          })(),
          fontWeight: 700,
          color: amountError ? "var(--color-status-error)" : (usdMode ? usdStr : amountStr) ? "var(--color-text-display)" : "var(--color-text-disabled)",
          letterSpacing: "-0.03em", lineHeight: 1.1, minHeight: "3.5rem",
          transition: "color 0.15s, font-size 0.15s",
        }}>
          {usdMode
            ? (usdStr ? `$${Number(usdStr).toLocaleString()}` : "$0")
            : (amountStr ? Number(amountStr).toLocaleString() : "0")
          }
        </span>

        <TextButton onClick={onToggleCurrency} tone="muted">
          {usdMode
            ? (amountStr ? `≈ ${Number(amountStr).toLocaleString()} QU` : "QU")
            : (fiatEquiv && fiatEquiv !== "—" ? fiatEquiv : displayCurrency)
          }
        </TextButton>

        {amountError && (
          <span style={{ ...labelStyle, color: "var(--color-status-error)", fontSize: "var(--text-label)" }}>{amountError}</span>
        )}
      </div>

      {/* Recipient */}
      <div style={{ flex: "0 0 auto", position: "relative" }}>
        <div style={{
          background: "var(--color-bg-surface)",
          borderRadius: "var(--radius-card)",
          padding: "var(--space-4) var(--space-4)",
          boxShadow: "var(--shadow-surface)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <UserCircleIcon size={16} style={{ flexShrink: 0, color: "var(--color-text-disabled)" }} />
            <EmbeddedInput
              ref={destRef}
              autoComplete="off"
              value={destination}
              onChange={(e) => onChangeDestination(e.target.value)}
              placeholder="Enter address or contact"
              onFocus={(e) => { e.currentTarget.parentElement!.style.borderColor = "var(--color-text-secondary)"; }}
              onBlur={(e) => { e.currentTarget.parentElement!.style.borderColor = "transparent"; }}
              style={{ flex: 1 }}
            />
            {canOpenPicker && (
              <button onClick={onOpenPicker}
                style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4, color: "var(--color-text-disabled)", display: "flex" }}>
                <UserGroupIcon size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Suggestions overlay */}
        {destination.trim() && (
          <AddressSuggestionsOverlay
            suggestions={suggestions}
            currentIdentity={destUpper}
            onSelect={onSelectDestination}
            maxHeight={240}
            animated
          />
        )}
        {!destError && matchedContactName && (
          <span style={{ ...labelStyle, color: "var(--color-accent)", fontSize: "var(--text-label)", paddingLeft: "var(--space-1)", marginTop: "var(--space-1)", display: "block" }}>{matchedContactName}</span>
        )}
        {destError && (
          <span style={{ ...labelStyle, color: "var(--color-status-error)", fontSize: "var(--text-label)", paddingLeft: "var(--space-1)", marginTop: "var(--space-1)", display: "block" }}>{destError}</span>
        )}
      </div>

      {/* Available balance */}
      {balance !== null && (
        <div style={{ flex: "0 0 auto", textAlign: "center", paddingBottom: "var(--space-1)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-disabled)" }}>
            {formatQu(balance)} available
          </span>
        </div>
      )}

      {/* Numpad */}
      <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingTop: 0 }}>
        <Numpad onPress={onNumpad} onMax={onMax} />
      </div>

      {/* Actions */}
      <div style={{ flex: "0 0 auto", padding: "var(--space-3) 0 var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <Button onClick={onReview} disabled={!canReview}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}>
            Review <ArrowUpRight01Icon size={16} strokeWidth={2} />
          </span>
        </Button>
      </div>

      <ContactPicker
        open={showPicker}
        onClose={onClosePicker}
        onSelect={onPickerSelect}
        contacts={contacts}
        accounts={accounts}
      />
    </SendStepPanel>
  );
}
