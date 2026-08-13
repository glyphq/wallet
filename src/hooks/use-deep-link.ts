import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { router } from "@/router";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { recordAuditEvent } from "@/lib/audit-log";
import { buildRequestNotification, parseGlyphEnvelopeAsync } from "@/lib/request-schema";
import { activeNetworkBinding } from "@/lib/network-binding";
import { acceptDeepLinkPayloadAfterNetworkMatch } from "@/lib/deep-link-acceptance";
import { drainPendingRequests } from "@/lib/pending-request-queue";

/** Listens for `glyph:request` Tauri events and cold-start pending requests, routing to /request when unlocked. */
export function useDeepLink() {
  const enqueuePendingRequest = useSessionStore((s) => s.enqueuePendingRequest);
  const isLocked = useSessionStore((s) => s.isLocked);
  const notificationsEnabled = usePersistedStore((s) => s.settings.notificationsEnabled);

  // Refs keep the single effect's callbacks up-to-date without re-subscribing.
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const enqueuePendingRequestRef = useRef(enqueuePendingRequest);
  enqueuePendingRequestRef.current = enqueuePendingRequest;
  const notificationsEnabledRef = useRef(notificationsEnabled);
  notificationsEnabledRef.current = notificationsEnabled;
  const pendingRequestDrainRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function applyAcceptedPayload(payload: string) {
      const parsed = await parseGlyphEnvelopeAsync(payload, await activeNetworkBinding(usePersistedStore.getState().settings.network));
      if (!parsed.envelope) return;
      enqueuePendingRequestRef.current(payload);
      recordAuditEvent({
        kind: "request_received",
        status: "info",
        title: "Request received",
        detail: `${String(parsed.envelope.request.type).replace(/_/g, " ")} from ${parsed.envelope.request.dapp.origin}`,
      });
      if (notificationsEnabledRef.current) {
        const n = buildRequestNotification(parsed.envelope.request);
        if (n) {
          publishNotificationEvent(createNotificationEvent({
            kind: "deep_link",
            title: n.title,
            body: n.body,
          })).catch(() => {});
        }
      }
      if (!isLockedRef.current) {
        router.navigate("/request");
      }
      // If locked, lock screen reads pendingRequests and navigates to /request after unlock.
    }

    function drainPendingRequestQueue() {
      if (pendingRequestDrainRef.current) return pendingRequestDrainRef.current;
      const drain = drainPendingRequests({
        getPendingRequest: () => invoke<string | null>("get_pending_request"),
        acceptPendingRequest: (payload) => acceptDeepLinkPayloadAfterNetworkMatch({
          payload,
          networkSetting: usePersistedStore.getState().settings.network,
          invokeNative: invoke,
        }),
        onAccepted: applyAcceptedPayload,
      }).catch(() => {
        // A transient IPC failure leaves the native queue head intact for the
        // next event or cold-start check.
      });
      pendingRequestDrainRef.current = drain;
      void drain.finally(() => {
        if (pendingRequestDrainRef.current === drain) {
          pendingRequestDrainRef.current = null;
        }
      });
      return drain;
    }

    /*
     * Events are availability notifications, not the source of truth. Reading
     * payloads from the native queue serially prevents two async events from
     * accepting and clearing each other's queue head.
     */
    function applyPayload() {
      return drainPendingRequestQueue();
    }

    listen<string>("glyph:request", () => {
      void applyPayload();
    }).then((fn) => { unlisten = fn; }).catch(() => {});

    // Cold start: wait for the persisted store to hydrate before reading the Rust-side queue.
    // Without this, vaults.length = 0 at first render (pre-hydration), which would
    // cause routing to settle before the persisted vault state is available.
    async function checkPending() {
      try {
        await applyPayload();
      } catch {
        // non-fatal
      }
    }

    if (usePersistedStore.persist.hasHydrated()) {
      void checkPending();
    } else {
      const unsub = usePersistedStore.persist.onFinishHydration(() => {
        void checkPending();
        unsub();
      });
    }

    return () => { unlisten?.(); };
  }, []); // Stable: registered once; stale-closure handled via refs above.
}
