import type { CSSProperties, ReactNode } from "react";
import { AppShell } from "@/layouts/app-shell";
import { AmountInput } from "@/components/amount-input";
import { IconButton } from "@/components/icon-button";
import { Input } from "@/components/input";
import { Delete02Icon, UserGroupIcon } from "@/lib/icons";
import { formatPreferredCurrencyFromQu, formatQu } from "@/lib/format";
import type { PreferredCurrencyQuote } from "@/hooks/use-preferred-currency-quote";
import type { Contact } from "@/store/persisted";
import type { Recipient } from "./send-many-recipients";

const BODY_COPY: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-label)",
  lineHeight: "var(--leading-body)",
  color: "var(--color-text-tertiary)",
};

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-caption)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>
      {children}
    </span>
  );
}

/** Full-height send-many shell with pinned footer actions. */
export function SendManyShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <AppShell fullBleed contentStyle={{ overflow: "hidden", padding: 0 }}>
      <div style={{ display: "flex", flex: 1, height: "100%", minHeight: 0, minWidth: 0, flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-4)", width: "100%", maxWidth: 720, margin: "0 auto" }}>
          {children}
        </div>
        {footer ? (
          <div style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--space-4) var(--space-4)" }}>
            <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>{footer}</div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export function SummaryRow({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "error";
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)", minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, minWidth: 0, textAlign: "right" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)", color: tone === "error" ? "var(--color-status-error)" : "var(--color-text-primary)", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>
          {value}
        </span>
        {hint ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{hint}</span>
        ) : null}
      </span>
    </div>
  );
}

export function SendManySummary({
  totalAmount,
  fee,
  remaining,
  price,
  quote,
}: {
  totalAmount: bigint;
  fee: bigint | null;
  remaining: bigint | null;
  price: number | undefined;
  quote: PreferredCurrencyQuote;
}) {
  const overBalance = remaining !== null && remaining < 0n;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <SummaryRow
        label="Total"
        value={`${formatQu(totalAmount)} QU`}
        hint={price && totalAmount > 0n ? formatPreferredCurrencyFromQu(totalAmount, { usdPrice: price, ...quote }).text : undefined}
      />
      <SummaryRow label="QUtil fee" value={fee !== null ? `${formatQu(fee)} QU` : "Loading…"} />
      {remaining !== null ? (
        <SummaryRow
          label="Remaining"
          value={`${formatQu(remaining < 0n ? 0n : remaining)} QU`}
          tone={overBalance ? "error" : undefined}
        />
      ) : null}
    </div>
  );
}

export function RecipientEditor({
  recipient,
  index,
  totalCount,
  matchedContact,
  canOpenPicker,
  price,
  quote,
  onFieldChange,
  onEnter,
  onPickContact,
  onRemove,
  registerIdentityRef,
}: {
  recipient: Recipient;
  index: number;
  totalCount: number;
  matchedContact: Contact | undefined;
  canOpenPicker: boolean;
  price: number | undefined;
  quote: PreferredCurrencyQuote;
  onFieldChange: (field: Partial<Recipient>) => void;
  onEnter: () => void;
  onPickContact: () => void;
  onRemove: () => void;
  registerIdentityRef: (el: HTMLInputElement | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-3) 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <SectionLabel>Recipient {index + 1}</SectionLabel>
        <span style={{ flex: 1 }} />
        {canOpenPicker ? (
          <IconButton label={`Choose recipient ${index + 1}`} onClick={onPickContact} style={{ width: 32, height: 32 }}>
            <UserGroupIcon size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
        {totalCount > 1 ? (
          <IconButton label={`Remove recipient ${index + 1}`} onClick={onRemove} style={{ width: 32, height: 32 }}>
            <Delete02Icon size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      <Input
        ref={registerIdentityRef}
        value={recipient.identity}
        onChange={(event) => onFieldChange({ identity: event.target.value, identityError: "" })}
        onKeyDown={(event) => event.key === "Enter" && onEnter()}
        placeholder="Address or contact"
        autoComplete="off"
        error={recipient.identityError || undefined}
      />
      <AmountInput
        value={recipient.amount}
        onValueChange={(value) => onFieldChange({ amount: value, amountError: "" })}
        onKeyDown={(event) => event.key === "Enter" && onEnter()}
        placeholder="0"
        error={recipient.amountError || undefined}
      />
      {price && recipient.amount && /^\d+$/.test(recipient.amount) && BigInt(recipient.amount) > 0n ? (
        <span style={BODY_COPY}>{formatPreferredCurrencyFromQu(recipient.amount, { usdPrice: price, ...quote }).text}</span>
      ) : matchedContact && !recipient.identityError ? (
        <span style={{ ...BODY_COPY, color: "var(--color-accent)" }}>{matchedContact.name}</span>
      ) : null}
    </div>
  );
}
