import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { focusSheet, getTabbableElements, isTabbable } from "./sheet-focus";
import { isolateApplication, isTopSheet, registerActiveSheet } from "./sheet-layer";

export interface SheetLifecycleOptions {
  open: boolean;
  layer: number;
  onClose: () => void;
  overlayRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onSheetClose: () => void;
}

/**
 * Wires a sheet into the shared stacking, focus-trap, and app-isolation
 * machinery for as long as it is open.
 */
export function useSheetLifecycle({
  open,
  layer,
  onClose,
  overlayRef,
  panelRef,
  onOpen,
  onSheetClose,
}: SheetLifecycleOptions) {
  const returnFocusRef = useRef<Element | null>(document.activeElement);
  const sheetIdRef = useRef(Symbol("sheet"));
  const onCloseRef = useRef(onClose);

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
      const currentPanel = panelRef.current;
      const activeElement = document.activeElement as HTMLElement | null;
      const tabbableElements = currentPanel ? getTabbableElements(currentPanel) : [];
      const autofocusElement = currentPanel
        ? Array.from(currentPanel.querySelectorAll<HTMLElement>("[autofocus]")).find(isTabbable)
        : undefined;
      const initialFocus = activeElement && currentPanel?.contains(activeElement)
        ? activeElement
        : autofocusElement
          ?? tabbableElements[0]
          ?? currentPanel;
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

      const activePanel = panelRef.current;
      if (!activePanel) return;
      const focusable = getTabbableElements(activePanel);
      if (focusable.length === 0) {
        e.preventDefault();
        activePanel.focus();
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
        else focusSheet(nextTopSheet.panel);
      } else if (returnTarget?.isConnected) {
        returnTarget.focus();
      }
    };
  }, [layer, open, overlayRef, panelRef]);
}
