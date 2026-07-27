import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

function isHistoryShortcut(event: KeyboardEvent): boolean {
  if (event.key === "BrowserBack" || event.key === "BrowserForward") return true;
  if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return true;
  if (event.metaKey && (event.key === "[" || event.key === "]")) return true;
  return event.key === "Backspace" && !isEditableTarget(event.target);
}

/**
 * Prevents browser and webview history navigation while preserving explicit
 * application navigation through React Router controls.
 */
export function useDisableHistoryNavigation() {
  useEffect(() => {
    function blockKeyboardHistory(event: KeyboardEvent) {
      if (!isHistoryShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
    }

    function blockMouseHistory(event: MouseEvent) {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("keydown", blockKeyboardHistory, { capture: true });
    window.addEventListener("mousedown", blockMouseHistory, { capture: true });
    window.addEventListener("mouseup", blockMouseHistory, { capture: true });
    window.addEventListener("auxclick", blockMouseHistory, { capture: true });

    return () => {
      window.removeEventListener("keydown", blockKeyboardHistory, { capture: true });
      window.removeEventListener("mousedown", blockMouseHistory, { capture: true });
      window.removeEventListener("mouseup", blockMouseHistory, { capture: true });
      window.removeEventListener("auxclick", blockMouseHistory, { capture: true });
    };
  }, []);
}
