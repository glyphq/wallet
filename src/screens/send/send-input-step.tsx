import type { ReactNode, RefObject } from "react";
import { ArrowUpRight01Icon, UserGroupIcon } from "@/lib/icons";
import { DropdownSelect } from "@/components/dropdown-select";
import { FramedAvatar } from "@/components/framed-avatar";
import { IdentityPickerScreen } from "@/components/identity-picker";
import { formatQu, truncateId } from "@/lib/format";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { ChoiceChips } from "@/components/choice-chips";
import { TextButton } from "@/components/text-button";
import type { AddressSuggestion } from "@/lib/address-intelligence";
import type { Contact } from "@/store/persisted";
import { SendStepPanel } from "./send-step-panel";
import { AddressSuggestionsOverlay, labelStyle, SendStepFooter } from "./send-ui";

export interface SendInputStepProps {
  statusBar: ReactNode;
  sourceAccounts: { index: number; identity: string; name: string }[];
  selectedAccountIndex: number;
  onSelectAccount: (index: number) => void;
  draftRestored: boolean;
  onDismissDraft: () => void;
  amountStr: string;
  amountError: string;
  fiatEquiv: string | null;
  amountUnit: "qubic" | "fiat";
  fiatInput: string;
  currencyLabel: string;
  canToggleAmountUnit: boolean;
  onAmountChange: (value: string) => void;
  onFiatInputChange: (value: string) => void;
  onToggleAmountUnit: () => void;
  onPercent: (percent: 25 | 50 | 75 | 100) => void;
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
  pickerAccounts: { name: string; identity: string }[];
  showPicker: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
}

/** Standard wallet send form: source, recipient, amount, review. */
export function SendInputStep({
  statusBar,
  sourceAccounts,
  selectedAccountIndex,
  onSelectAccount,
  draftRestored,
  onDismissDraft,
  amountStr,
  amountError,
  fiatEquiv,
  amountUnit,
  fiatInput,
  currencyLabel,
  canToggleAmountUnit,
  onAmountChange,
  onFiatInputChange,
  onToggleAmountUnit,
  onPercent,
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
  pickerAccounts,
  showPicker,
  onOpenPicker,
  onClosePicker,
}: SendInputStepProps) {
  const selectedSourceAccount = sourceAccounts.find((account) => account.index === selectedAccountIndex) ?? sourceAccounts[0];

  if (showPicker) {
    return (
      <IdentityPickerScreen
        title="Choose recipient"
        contacts={contacts}
        accounts={pickerAccounts}
        onSelect={onPickerSelect}
        onClose={onClosePicker}
      />
    );
  }

  return (
    <SendStepPanel minHeight="min-content" scroll="y" statusBar={statusBar}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1 }}>
        {draftRestored ? (
          <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3)", border: "1px solid var(--color-border-subtle)", borderRadius: "var(--radius-sharp)", background: "var(--color-bg-surface)" }}>
            <span style={{ ...labelStyle, color: "var(--color-status-warning)" }}>Draft restored</span>
            <TextButton onClick={onDismissDraft} tone="muted">Dismiss</TextButton>
          </div>
        ) : null}

        <DropdownSelect
          id="send-account"
          label={selectedSourceAccount?.name ?? "Account"}
          value={String(selectedAccountIndex)}
          options={sourceAccounts.map((account) => ({
            value: String(account.index),
            label: truncateId(account.identity, 8, 8),
            icon: <FramedAvatar seed={account.identity} size={28} />,
          }))}
          onChange={(value) => onSelectAccount(Number(value))}
        />

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
            value={amountUnit === "qubic" ? amountStr : fiatInput}
            onChange={(event) => {
              const value = event.target.value.replace(amountUnit === "qubic" ? /[^\d]/g : /[^\d.]/g, "");
              if (amountUnit === "qubic") onAmountChange(value);
              else onFiatInputChange(value);
            }}
            placeholder="0"
            inputMode={amountUnit === "qubic" ? "numeric" : "decimal"}
            autoComplete="off"
            maxLength={amountUnit === "qubic" ? 20 : 24}
            error={amountError || undefined}
            rightElement={(
              <button
                type="button"
                onClick={onToggleAmountUnit}
                disabled={amountUnit === "qubic" && !canToggleAmountUnit}
                aria-label="Switch amount currency"
                style={{ border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.1em", color: canToggleAmountUnit ? "var(--color-accent)" : "var(--color-text-tertiary)", cursor: canToggleAmountUnit ? "pointer" : "not-allowed" }}
              >
                {amountUnit === "qubic" ? "QUBIC" : currencyLabel}
              </button>
            )}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap", minHeight: 26 }}>
            <ChoiceChips
              label="Amount percentage"
              options={([25, 50, 75, 100] as const).map((percent) => ({ value: percent, label: percent === 100 ? "MAX" : `${percent}%` }))}
              onSelect={onPercent}
              disabled={balance === null}
              style={{ maxWidth: "none", width: "auto" }}
            />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
              {amountUnit === "qubic" ? (fiatEquiv ?? "") : (amountStr ? `${formatQu(amountStr)} QUBIC` : "")}
            </span>
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



      <SendStepFooter>
        <Button onClick={onReview} disabled={!canReview} style={{ width: "100%" }}>
          Review transfer
          <ArrowUpRight01Icon size={16} strokeWidth={2} aria-hidden="true" />
        </Button>
      </SendStepFooter>


    </SendStepPanel>
  );
}
