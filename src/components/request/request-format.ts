/** Truncates long message text for review display while reporting the full length. */
export function previewText(value: string, maxChars = 2000): string {
  return value.length > maxChars
    ? `${value.slice(0, maxChars)}\n\n[… ${value.length.toLocaleString()} chars total]`
    : value;
}
