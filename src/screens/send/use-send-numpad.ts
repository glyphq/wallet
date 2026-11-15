import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";

export interface UseSendNumpadInputOptions {
  /** Only listen for physical keys while the input step is active. */
  active: boolean;
  usdMode: boolean;
  price: number | undefined;
  usdStr: string;
  setUsdStr: Dispatch<SetStateAction<string>>;
  setAmountStr: Dispatch<SetStateAction<string>>;
  setAmountError: Dispatch<SetStateAction<string>>;
  onEnter: () => void;
}

/**
 * Numpad amount handler plus physical keyboard support for the send input step.
 * Returns the handler for the on-screen keypad.
 */
export function useSendNumpadInput({
  active,
  usdMode,
  price,
  usdStr,
  setUsdStr,
  setAmountStr,
  setAmountError,
  onEnter,
}: UseSendNumpadInputOptions): (key: string) => void {
  const handleNumpad = useCallback((key: string) => {
    setAmountError("");
    if (usdMode) {
      if (key === "⌫") {
        setUsdStr((prev) => prev.slice(0, -1));
        if (price) {
          const newStr = usdStr.slice(0, -1);
          const n = parseFloat(newStr);
          setAmountStr(!isNaN(n) && n > 0 ? Math.round(n / price).toString() : "");
        }
      } else {
        const next = usdStr + key;
        if (price) {
          const n = parseFloat(next);
          const quAmount = !isNaN(n) && n > 0 ? Math.round(n / price) : 0;
          setAmountStr(quAmount > 0 ? quAmount.toString() : "");
        }
        setUsdStr(next);
      }
    } else {
      if (key === "⌫") {
        setAmountStr((prev) => prev.slice(0, -1));
      } else {
        setAmountStr((prev) => {
          if (prev === "0" && key !== "0") return key;
          if (prev === "0" && key === "0") return prev;
          return prev + key;
        });
      }
    }
  }, [usdMode, price, usdStr, setAmountError, setAmountStr, setUsdStr]);

  // Keyboard support: re-registered every render so it closes over fresh state.
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const isEditingText = !!target?.closest('input, textarea, select, [contenteditable="true"]');
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || isEditingText) return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleNumpad(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleNumpad("⌫");
      } else if (e.key === "Enter") {
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return handleNumpad;
}
