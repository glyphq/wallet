import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { presets, transition } from "@/lib/animations";
import { useSheetRegister } from "@/layouts/sheet-state";

const FOCUSABLE = [
  "a[href]", "area[href]", "button", 'input:not([type="hidden"])',
  "select", "textarea", "iframe", "object", "embed",
  "audio[controls]", "video[controls]", "summary",
  '[contenteditable]:not([contenteditable="false"])', "[tabindex]",
].join(",");

let isolationCount = 0;
let isolatedRoot: HTMLElement | null = null;
let rootWasInert = false;
let rootAriaHidden: string | null = null;
const DrawerDepthContext = createContext(0);

function isTabbable(el: HTMLElement) {
  if (el.tabIndex < 0 || el.matches(":disabled")) return false;
  if (el.closest('[inert], [aria-hidden="true"]')) return false;
  const s = getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && el.getClientRects().length > 0;
}

function getTabbable(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isTabbable);
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

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Width in pixels. Defaults to 300. */
  width?: number;
}

export function Drawer({ open, onClose, title, children, footer, width = 300 }: DrawerProps) {
  const depth = useContext(DrawerDepthContext);
  const layer = 50 + depth;
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(document.activeElement);
  const titleId = useId();
  const { onOpen, onClose: onSheetClose } = useSheetRegister();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    onOpen();
    return onSheetClose;
  }, [open, onOpen, onSheetClose]);

  useLayoutEffect(() => {
    if (open) return;
    return () => { returnFocusRef.current = document.activeElement; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;
    const releaseIsolation = isolateApplication();

    const frame = requestAnimationFrame(() => {
      const autofocus = panel.querySelector<HTMLElement>("[autofocus]");
      const tabbable = getTabbable(panel);
      (autofocus && isTabbable(autofocus) ? autofocus : tabbable[0] ?? panel).focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getTabbable(panel);
      if (focusable.length === 0) { e.preventDefault(); panel.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      releaseIsolation();
      const returnTarget = returnFocusRef.current as HTMLElement | null;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [open]);

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
            zIndex: layer,
          }}
        >
          <DrawerDepthContext.Provider value={depth + 1}>
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-label={title ? undefined : "Navigation drawer"}
              tabIndex={-1}
              initial={{ x: -width }}
              animate={{ x: 0 }}
              exit={{ x: -width }}
              transition={transition.enter}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width,
                maxWidth: "85vw",
                background: "var(--color-bg-elevated)",
                borderRight: "1px solid var(--color-border-strong)",
                display: "flex",
                flexDirection: "column",
                boxShadow: "var(--shadow-overlay)",
              }}
            >
              {/* Drag handle */}
              <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-3)" }}>
                <div style={{ width: 32, height: 2, background: "var(--color-border-contrast)", borderRadius: 999 }} />
              </div>

              {title && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-4) var(--space-4) var(--space-3)" }}>
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
                    style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-disabled)", padding: 0, lineHeight: 1, fontSize: 14, borderRadius: "var(--radius-control)" }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div style={{ overflowY: "auto", flex: 1, padding: "0 var(--space-4)" }}>
                {children}
              </div>

              {footer && (
                <div style={{
                  flexShrink: 0,
                  borderTop: "1px solid var(--color-border-subtle)",
                  padding: "var(--space-3) var(--space-4) var(--space-4)",
                }}>
                  {footer}
                </div>
              )}
            </motion.div>
          </DrawerDepthContext.Provider>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
