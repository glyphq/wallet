import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { presets } from "@/lib/animations";
import { useSheetRegister } from "@/layouts/sheet-state";

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

let isolationCount = 0;
let isolatedRoot: HTMLElement | null = null;
let rootWasInert = false;
let rootAriaHidden: string | null = null;
const SheetDepthContext = createContext(0);

interface ActiveSheet {
  id: symbol;
  layer: number;
  overlay: HTMLDivElement;
  panel: HTMLDivElement;
}

const activeSheets = new Map<symbol, ActiveSheet>();

function getTopSheet() {
  let topSheet: ActiveSheet | null = null;

  for (const sheet of activeSheets.values()) {
    if (!sheet.overlay.isConnected) continue;
    if (!topSheet || sheet.layer > topSheet.layer) {
      topSheet = sheet;
      continue;
    }
    if (sheet.layer !== topSheet.layer) continue;

    const position = topSheet.overlay.compareDocumentPosition(sheet.overlay);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) topSheet = sheet;
  }

  return topSheet;
}

function syncSheetIsolation() {
  const topSheet = getTopSheet();
  for (const sheet of activeSheets.values()) {
    const isTop = sheet.id === topSheet?.id;
    sheet.overlay.inert = !isTop;
    if (isTop) sheet.overlay.removeAttribute("aria-hidden");
    else sheet.overlay.setAttribute("aria-hidden", "true");
  }
}

function registerActiveSheet(sheet: ActiveSheet) {
  activeSheets.set(sheet.id, sheet);
  syncSheetIsolation();

  return () => {
    if (!activeSheets.has(sheet.id)) {
      return { wasTopSheet: false, nextTopSheet: getTopSheet() };
    }
    const wasTopSheet = getTopSheet()?.id === sheet.id;
    sheet.overlay.inert = true;
    sheet.overlay.setAttribute("aria-hidden", "true");
    activeSheets.delete(sheet.id);
    syncSheetIsolation();
    return { wasTopSheet, nextTopSheet: getTopSheet() };
  };
}

function isTopSheet(id: symbol) {
  return getTopSheet()?.id === id;
}

function isTabbable(element: HTMLElement) {
  if (element.tabIndex < 0 || element.matches(":disabled")) return false;
  if (element.closest('[inert], [aria-hidden="true"]')) return false;

  const style = getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && element.getClientRects().length > 0;
}

function getTabbableElements(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isTabbable);
}

function focusSheet(sheet: ActiveSheet) {
  const activeElement = document.activeElement as HTMLElement | null;
  const target = activeElement && sheet.panel.contains(activeElement)
    ? activeElement
    : getTabbableElements(sheet.panel)[0] ?? sheet.panel;
  target.focus();
}

function isolateApplication() {
  const root = document.getElementById("root");
  if (!root) return () => {};

  if (isolationCount === 0) {
    isolatedRoot = root;
    rootWasInert = root.inert;
    rootAriaHidden = root.getAttribute("aria-hidden");
    root.inert = true;
    root.setAttribute("aria-hidden", "true");
  }
  isolationCount += 1;

  return () => {
    isolationCount = Math.max(0, isolationCount - 1);
    if (isolationCount !== 0 || !isolatedRoot) return;
    isolatedRoot.inert = rootWasInert;
    if (rootAriaHidden === null) isolatedRoot.removeAttribute("aria-hidden");
    else isolatedRoot.setAttribute("aria-hidden", rootAriaHidden);
    isolatedRoot = null;
    rootAriaHidden = null;
  };
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const depth = useContext(SheetDepthContext);
  const layer = 50 + depth;
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(document.activeElement);
  const sheetIdRef = useRef(Symbol("sheet"));
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const { onOpen, onClose: onSheetClose } = useSheetRegister();

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    onOpen();
    return onSheetClose;
  }, [open, onOpen, onSheetClose]);

  useLayoutEffect(() => {
    if (open) return;

    // Layout-effect cleanup runs before newly opened children receive autofocus.
    return () => {
      returnFocusRef.current = document.activeElement;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const sheetId = sheetIdRef.current;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    const unregisterActiveSheet = registerActiveSheet({ id: sheetId, layer, overlay, panel });
    const releaseIsolation = isolateApplication();
    const frame = requestAnimationFrame(() => {
      if (!isTopSheet(sheetId)) return;
      const panel = panelRef.current;
      const activeElement = document.activeElement as HTMLElement | null;
      const tabbableElements = panel ? getTabbableElements(panel) : [];
      const autofocusElement = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>("[autofocus]")).find(isTabbable)
        : undefined;
      const initialFocus = activeElement && panel?.contains(activeElement)
        ? activeElement
        : autofocusElement
          ?? tabbableElements[0]
          ?? panel;
      initialFocus?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (!isTopSheet(sheetId) || e.defaultPrevented || e.isComposing) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = getTabbableElements(panel);
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      const { wasTopSheet, nextTopSheet } = unregisterActiveSheet();
      releaseIsolation();
      const returnTarget = returnFocusRef.current as HTMLElement | null;
      if (!wasTopSheet) return;
      if (nextTopSheet) {
        if (returnTarget?.isConnected && nextTopSheet.panel.contains(returnTarget)) returnTarget.focus();
        else focusSheet(nextTopSheet);
      } else if (returnTarget?.isConnected) {
        returnTarget.focus();
      }
    };
  }, [layer, open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          {...presets.overlay}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "var(--color-scrim)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            zIndex: layer,
          }}
        >
          <SheetDepthContext.Provider value={depth + 1}>
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-label={title ? undefined : "Dialog"}
              tabIndex={-1}
              {...presets.slideUp}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--color-bg-elevated)",
                borderTop: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
                padding: "var(--sheet-padding) var(--sheet-padding) 0",
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "var(--shadow-elevated)",
              }}
            >
              {/* Drag handle */}
              <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-4)" }}>
                <div style={{ width: 32, height: 2, background: "var(--color-border-contrast)", borderRadius: 999 }} />
              </div>

              {title && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <h2 id={titleId} style={{
                    fontFamily: "var(--font-display)", fontSize: "var(--text-section)", fontWeight: 600,
                    color: "var(--color-text-primary)", letterSpacing: "-0.02em", margin: 0,
                  }}>
                    {title}
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label={`Close ${title}`}
                    style={{ width: 44, height: 44, background: "none", border: "none", cursor: "pointer", color: "var(--color-text-disabled)", padding: 0, lineHeight: 1, fontSize: 14 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div style={{ overflowY: "auto", flex: 1, padding: "0 0 var(--space-4)" }}>
                {children}
              </div>

              {footer && (
                <div style={{
                  flexShrink: 0,
                  borderTop: "1px solid var(--color-border-subtle)",
                  paddingTop: "var(--space-4)",
                  paddingBottom: "var(--space-8)",
                }}>
                  {footer}
                </div>
              )}
            </motion.div>
          </SheetDepthContext.Provider>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
