import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { router } from "@/router";

interface PayPayload {
  to: string;
  amount?: string | null;
  label?: string | null;
}

/** Listens for sigil://pay deep links and navigates to the send screen with pre-filled params. */
export function usePayLink() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<string>("sigil:pay", (event) => {
      try {
        const pay = JSON.parse(event.payload) as PayPayload;
        const params = new URLSearchParams({ to: pay.to });
        if (pay.amount) params.set("amount", pay.amount);
        if (pay.label) params.set("label", pay.label);
        router.navigate(`/send?${params.toString()}`);
      } catch {
        // malformed payload — ignore
      }
    }).then((fn) => { unlisten = fn; }).catch(() => {});

    return () => { unlisten?.(); };
  }, []);
}
