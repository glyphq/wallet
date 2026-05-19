import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { router } from "@/router";

export function useDeepLink() {
  const setPendingRequest = useSessionStore((s) => s.setPendingRequest);
  const isLocked = useSessionStore((s) => s.isLocked);
  const vaultCount = usePersistedStore((s) => s.vaults.length);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<string>("sigil:request", (event) => {
      try {
        const envelope = JSON.parse(event.payload) as { request?: { type?: string } };
        if (!envelope.request?.type) return;
        setPendingRequest(event.payload);
        if (vaultCount === 0) {
          // No wallet yet — welcome screen shows the pending request banner
          router.navigate("/setup");
        } else if (!isLocked) {
          router.navigate("/request");
        }
        // If locked with a vault, stay — lock screen navigates to /request after unlock
      } catch {
        // malformed payload — Rust should have rejected it already
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [setPendingRequest, isLocked, vaultCount]);
}
