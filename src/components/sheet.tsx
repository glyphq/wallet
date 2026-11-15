import { createContext, useContext, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { presets } from "@/lib/animations";
import { useSheetRegister } from "@/layouts/sheet-state";
import { SheetBody, SheetDragHandle, SheetFooter, SheetHeader } from "./sheet-chrome";
import { useSheetLifecycle } from "./use-sheet-lifecycle";

const SheetDepthContext = createContext(0);

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
  const titleId = useId();
  const { onOpen, onClose: onSheetClose } = useSheetRegister();

  useSheetLifecycle({
    open,
    layer,
    onClose,
    overlayRef,
    panelRef,
    onOpen,
    onSheetClose,
  });

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
              <SheetDragHandle />

              {title && <SheetHeader titleId={titleId} title={title} onClose={onClose} />}

              <SheetBody>{children}</SheetBody>

              {footer && <SheetFooter>{footer}</SheetFooter>}
            </motion.div>
          </SheetDepthContext.Provider>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
