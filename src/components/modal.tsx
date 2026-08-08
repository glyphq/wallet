import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { presets } from "@/lib/animations";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
}


const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({ open, onClose, children, style, title }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement;

    // Move focus into modal on next frame (after animation starts)
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel)?.focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (focusable.length === 0) { e.preventDefault(); return; }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      (returnFocusRef.current as HTMLElement | null)?.focus();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          {...presets.overlay}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--color-scrim)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            zIndex: "var(--z-modal)",
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : "Dialog"}
            tabIndex={-1}
            {...presets.fadeIn}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-card) var(--radius-card) 0 0",
              padding: "var(--space-6)",
              maxHeight: "80vh",
              overflowY: "auto",
              ...style,
            }}
          >
            {title ? <h2 id={titleId} style={{ margin: "0 0 var(--space-4)" }}>{title}</h2> : null}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
