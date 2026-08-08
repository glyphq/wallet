import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { router } from "@/router";
import { parsePayLink } from "@/lib/pay-link";

/** Listens for glyph://pay deep links and navigates to the send screen with pre-filled params. */
export function usePayLink() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const consumePendingPay = async () => {
      try {
        while (true) {
          const payload = await invoke<string | null>("take_pending_pay");
          if (!payload) break;
          const pay = parsePayLink(payload);
          if (!pay) continue;
          const params = new URLSearchParams({ to: pay.to });
          if (pay.amount) params.set("amount", pay.amount);
          if (pay.label) params.set("label", pay.label);
          router.navigate(`/send?${params.toString()}`);
        }
      } catch {
        // malformed payload — ignore
      }
    };

    listen("glyph:pay", consumePendingPay)
      .then((fn) => {
        unlisten = fn;
        void consumePendingPay();
      })
      .catch(() => {});

    return () => { unlisten?.(); };
  }, []);
}
