import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSessionStore } from "@/store/session";
import { router } from "@/router";

export function useDeepLink() {
  const setPendingRequest = useSessionStore((s) => s.setPendingRequest);
  const isLocked = useSessionStore((s) => s.isLocked);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<string>("sigil:request", (event) => {
      try {
        const envelope = JSON.parse(event.payload) as { request?: { type?: string } };
        if (!envelope.request?.type) return;
        setPendingRequest(event.payload);
        // If locked, stay on lock screen — the lock screen navigates to /request after unlock
        if (!isLocked) {
          router.navigate("/request");
        }
      } catch {
        // malformed payload — Rust should have rejected it already
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [setPendingRequest, isLocked]);
}
