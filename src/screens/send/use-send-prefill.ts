import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { SendStep } from "./send-flow";

export interface SendDraft {
  destination: string;
  amountStr: string;
  savedAt: number;
}

export interface UseSendPrefillOptions {
  searchParams: URLSearchParams;
  step: SendStep;
  draft: SendDraft | null | undefined;
  clearDraft: () => void;
  setDestination: Dispatch<SetStateAction<string>>;
  setAmountStr: Dispatch<SetStateAction<string>>;
}

/**
 * URL parameter sync and one-shot draft restore for the send input step.
 * Returns the restore flag used by the input banner.
 */
export function useSendPrefill({
  searchParams,
  step,
  draft,
  clearDraft,
  setDestination,
  setAmountStr,
}: UseSendPrefillOptions): { draftRestored: boolean; dismissDraft: () => void } {
  const [draftRestored, setDraftRestored] = useState(false);
  const prevSearchRef = useRef(searchParams.toString());

  // Sync from URL
  useEffect(() => {
    const current = searchParams.toString();
    if (current === prevSearchRef.current) return;
    prevSearchRef.current = current;
    if (step !== "input") return;
    const to = searchParams.get("to");
    const amount = searchParams.get("amount");
    if (to) setDestination(to.toUpperCase());
    if (amount) setAmountStr(amount);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore draft
  useEffect(() => {
    if (draftRestored || !draft) return;
    const age = Date.now() - draft.savedAt;
    if (age < 30 * 60 * 1000) { setDestination(draft.destination); setAmountStr(draft.amountStr); }
    setDraftRestored(true);
    clearDraft();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { draftRestored, dismissDraft: () => setDraftRestored(false) };
}
