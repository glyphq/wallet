import { useLayoutEffect, useRef } from "react";
import { Input, type InputProps } from "@/components/input";

export interface AmountInputProps extends Omit<InputProps, "value" | "onChange" | "inputMode"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Fractional places allowed; omit or 0 for whole numbers only. */
  decimals?: number;
}

function groupDigits(value: string): string {
  const [whole, fraction] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction !== undefined ? `${grouped}.${fraction}` : grouped;
}

function sanitize(value: string, decimals: number): string {
  const compact = value.replace(/,/g, "");
  if (decimals <= 0) return compact.replace(/[^\d]/g, "");

  let cleaned = compact.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot !== -1) {
    cleaned = `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
    const [whole, fraction] = cleaned.split(".");
    cleaned = `${whole}.${fraction.slice(0, decimals)}`;
  }
  if (cleaned.startsWith(".")) cleaned = `0${cleaned}`;
  return cleaned;
}

function caretFromDisplay(display: string, caret: number): number {
  return display.slice(0, caret).replace(/,/g, "").length;
}

function displayIndexForSignificant(display: string, significant: number): number {
  let seen = 0;
  for (let index = 0; index < display.length; index++) {
    if (display[index] === ",") continue;
    if (seen === significant) return index;
    seen++;
  }
  return display.length;
}

/** Numeric input that displays grouped thousands while returning the raw value. */
export function AmountInput({
  value,
  onValueChange,
  decimals = 0,
  ...props
}: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const display = groupDigits(value);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || pendingCaret.current === null) return;
    const position = displayIndexForSignificant(display, pendingCaret.current);
    input.setSelectionRange(position, position);
    pendingCaret.current = null;
  }, [display]);

  return (
    <Input
      {...props}
      ref={inputRef}
      value={display}
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      onChange={(event) => {
        const nextDisplay = event.target.value;
        const caret = event.target.selectionStart ?? nextDisplay.length;
        const raw = sanitize(nextDisplay, decimals);
        const significant = Math.min(caretFromDisplay(nextDisplay, caret), raw.length);
        pendingCaret.current = significant;
        onValueChange(raw);
      }}
    />
  );
}
