import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { router } from "@/router";

export function useDeepLink() {
  const setPendingRequest = useSessionStore((s) => s.setPendingRequest);
  const isLocked = useSessionStore((s) => s.isLocked);
  const vaultCount = usePersistedStore((s) => s.vaults.length);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    function applyPayload(payload: string) {
      try {
        const envelope = JSON.parse(payload) as { request?: { type?: string } };
        if (!envelope.request?.type) return;
        setPendingRequest(payload);
        // Clear from Rust state now that the JS session store owns it
        invoke("clear_pending_request").catch(() => {});
        if (vaultCount === 0) {
          router.navigate("/setup");
        } else if (!isLocked) {
          router.navigate("/request");
        }
        // If locked with a vault, stay — lock screen navigates to /request after unlock
      } catch {
        // malformed payload — Rust should have rejected it already
      }
    }

    listen<string>("sigil:request", (event) => {
      applyPayload(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    // Pick up any request that arrived before this listener was registered (cold start).
    // The Rust side stores the payload persistently; peek() is non-destructive.
    invoke<string | null>("get_pending_request").then((payload) => {
      if (payload) applyPayload(payload);
    });

    return () => {
      unlisten?.();
    };
  }, [setPendingRequest, isLocked, vaultCount]);
}
