import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useSheetRegister } from "@/layouts/sheet-state";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const EASE_OUT = [0, 0, 0.2, 1] as const;

export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { onOpen, onClose: onSheetClose } = useSheetRegister();

  useEffect(() => {
    if (open) onOpen();
    else onSheetClose();
    return () => { if (open) onSheetClose(); };
  }, [open, onOpen, onSheetClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: EASE_OUT }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            zIndex: 50,
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-bg-elevated)",
              borderTop: "1px solid var(--color-border-strong)",
              borderRadius: "var(--radius-card) var(--radius-card) 0 0",
              padding: "var(--space-4) var(--space-4) 0",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-4)" }}>
              <div style={{ width: 36, height: 3, background: "var(--color-border-strong)", borderRadius: 2 }} />
            </div>

            {title && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: "var(--text-mono-sm)",
                  color: "var(--color-text-secondary)", letterSpacing: "0.08em",
                }}>
                  {title}
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-disabled)", padding: 0, lineHeight: 1, fontSize: 14 }}
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ overflowY: "auto", flex: 1, padding: "0 var(--space-1) var(--space-4)" }}>
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
