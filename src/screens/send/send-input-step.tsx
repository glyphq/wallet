import type { ReactNode, RefObject } from "react";
import { ArrowUpRight01Icon, UserGroupIcon } from "@/lib/icons";
import { ApprovalAddress } from "@/components/request/approval-address";
import { Button } from "@/components/button";
import { ContactPicker } from "@/components/contact-picker";
import { Input } from "@/components/input";
import { TextButton } from "@/components/text-button";
import { formatQu } from "@/lib/format";
import type { AddressSuggestion } from "@/lib/address-intelligence";
import type { Contact } from "@/store/persisted";
import { SendStepPanel } from "./send-step-panel";
import { AddressSuggestionsOverlay, labelStyle } from "./send-ui";

export interface SendInputStepProps {
  statusBar: ReactNode;
  accountName: string;
  identity: string;
  draftRestored: boolean;
  onDismissDraft: () => void;
  amountStr: string;
  amountError: string;
  fiatEquiv: string | null;
  onAmountChange: (value: string) => void;
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

/** Standard wallet send form: source, recipient, amount, review. */
export function SendInputStep({
  statusBar,
  accountName,
  identity,
  draftRestored,
  onDismissDraft,
  amountStr,
  amountError,
  fiatEquiv,
  onAmountChange,
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
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1 }}>
        {draftRestored ? (
          <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)", background: "var(--color-bg-surface)" }}>
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Draft restored</span>
            <TextButton onClick={onDismissDraft} tone="muted">Dismiss</TextButton>
          </div>
        ) : null}

        <ApprovalAddress label="From" identity={identity} name={accountName} compact="short" />

        <div style={{ position: "relative" }}>
          <Input
            ref={destRef}
            label="Recipient"
            value={destination}
            onChange={(event) => onChangeDestination(event.target.value)}
            placeholder="Address or contact"
            autoComplete="off"
            error={destError || undefined}
            rightElement={canOpenPicker ? (
              <button
                type="button"
                onClick={onOpenPicker}
                aria-label="Choose contact or account"
                style={{ border: 0, background: "transparent", padding: 0, display: "flex", color: "var(--color-text-tertiary)", cursor: "pointer" }}
              >
                <UserGroupIcon size={18} aria-hidden="true" />
              </button>
            ) : undefined}
          />
          {destination.trim() ? (
            <AddressSuggestionsOverlay
              suggestions={suggestions}
              currentIdentity={destUpper}
              onSelect={onSelectDestination}
              maxHeight={240}
              animated
            />
          ) : null}
          {!destError && matchedContactName ? (
            <span style={{ display: "block", marginTop: "var(--space-1)", paddingLeft: "var(--space-1)", fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-accent)" }}>
              {matchedContactName}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <Input
            label="Amount"
            value={amountStr}
            onChange={(event) => onAmountChange(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            error={amountError || undefined}
            rightElement={<span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.1em", color: "var(--color-text-tertiary)" }}>QUBIC</span>}
          />
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)", minHeight: 18 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
              {fiatEquiv ?? "\u00a0"}
            </span>
            {onMax ? <TextButton onClick={onMax} tone="muted">Use max</TextButton> : null}
          </div>
        </div>

        {balance !== null ? (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>Available balance</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: "var(--color-text-secondary)", letterSpacing: "0.04em" }}>
              {formatQu(balance)} QUBIC
            </span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 5,
          marginInline: "calc(var(--space-4) * -1)",
          padding: "var(--space-3) var(--space-4)",
          borderTop: "1px solid var(--color-border-subtle)",
          background: "var(--color-bg-base)",
        }}
      >
        <Button onClick={onReview} disabled={!canReview} style={{ width: "100%" }}>
          Review transfer
          <ArrowUpRight01Icon size={16} strokeWidth={2} aria-hidden="true" />
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
