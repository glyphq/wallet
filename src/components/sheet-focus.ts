const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
].join(",");

export function isTabbable(element: HTMLElement) {
  if (element.tabIndex < 0 || element.matches(":disabled")) return false;
  if (element.closest('[inert], [aria-hidden="true"]')) return false;

  const style = getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && element.getClientRects().length > 0;
}

export function getTabbableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isTabbable);
}

export function focusSheet(panel: HTMLElement) {
  const activeElement = document.activeElement as HTMLElement | null;
  const target = activeElement && panel.contains(activeElement)
    ? activeElement
    : getTabbableElements(panel)[0] ?? panel;
  target.focus();
}
