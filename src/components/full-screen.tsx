import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "@/lib/animations";
import { ScreenHeader } from "./screen-header";

export interface FullScreenProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Full-window page for focused flows. */
export function FullScreen({ open, onClose, title, children, footer }: FullScreenProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          {...pageTransition}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: "var(--z-modal)",
            display: "flex",
            flexDirection: "column",
            background: "var(--color-bg-base)",
            outline: "none",
          }}
        >
          <header style={{ flexShrink: 0, padding: "var(--space-3) var(--screen-padding)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <ScreenHeader title={title} onBack={onClose} backAriaLabel="Back" />
          </header>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "var(--space-4) var(--screen-padding) var(--space-8)" }}>
            <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {children}
            </div>
          </div>
          {footer ? (
            <footer style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--screen-padding) var(--space-4)" }}>
              <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>{footer}</div>
            </footer>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
