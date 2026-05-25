import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "@/store/session";
import { usePersistedStore } from "@/store/persisted";
import { router } from "@/router";
import { createNotificationEvent, publishNotificationEvent } from "@/lib/notification-events";
import { CONTRACT_NAMES, CONTRACT_PROCEDURE_NAMES } from "@/lib/contracts";
import { truncateIdentity } from "@/lib/crypto";
import { formatQu } from "@/lib/format";
import { recordAuditEvent } from "@/lib/audit-log";

function parseQuAmount(value: unknown): bigint | null {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
      return BigInt(value);
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      return BigInt(value);
    }
  } catch {}
  return null;
}

function buildNotification(req: Record<string, unknown>): { title: string; body: string } | null {
  switch (req.type) {
    case "transfer": {
      const amount = parseQuAmount(req.amount);
      const to = truncateIdentity(String(req.to ?? ""));
      return {
        title: "Request Waiting For Review",
        body: amount !== null
          ? `Transfer ${formatQu(amount)} QU to ${to}.`
          : `Transfer QU to ${to}.`,
      };
    }
    case "sc_call": {
      const idx = req.contract_index as number;
      const contractName = CONTRACT_NAMES[idx] ?? `Contract #${idx}`;
      const procName = CONTRACT_PROCEDURE_NAMES[`${idx}:${req.input_type}`] ?? null;
      const label = procName ? `${contractName} · ${procName}` : contractName;
      const amount = parseQuAmount(req.amount);
      return {
        title: "Request Waiting For Review",
        body: amount !== null && amount > 0n
          ? `Contract call: ${label} for ${formatQu(amount)} QU.`
          : `Contract call: ${label}.`,
      };
    }
    case "sign_message":
      return {
        title: "Request Waiting For Review",
        body: "Message signing request received.",
      };
    case "verify_message":
      return {
        title: "Request Waiting For Review",
        body: "Signature verification request received.",
      };
    case "connect":
      return {
        title: "Request Waiting For Review",
        body: "Connection request received.",
      };
    default:
      return null;
  }
}

/** Listens for `sigil:request` Tauri events and cold-start pending requests, routing to /request when unlocked. */
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

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    function applyPayload(payload: string) {
      try {
        const envelope = JSON.parse(payload) as { request?: Record<string, unknown> };
        if (!envelope.request?.type) return;
        enqueuePendingRequestRef.current(payload);
        invoke("clear_pending_request").catch(() => {});
        recordAuditEvent({
          kind: "request_received",
          status: "info",
          title: "Request received",
          detail: `${String(envelope.request.type).replace(/_/g, " ")} from ${String((envelope.request.dapp as { origin?: unknown })?.origin ?? "unknown origin")}`,
        });
        if (notificationsEnabledRef.current) {
          const n = buildNotification(envelope.request);
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
      } catch {
        // malformed — Rust should have rejected it already
      }
    }

    listen<string>("sigil:request", (event) => {
      applyPayload(event.payload);
    }).then((fn) => { unlisten = fn; }).catch(() => {});

    // Cold start: wait for the persisted store to hydrate before reading the Rust-side stored
    // request. Without this, vaults.length = 0 at first render (pre-hydration), which would
    // cause applyPayload to clear the pending request before routing is settled.
    async function checkPending() {
      try {
        while (true) {
          const payload = await invoke<string | null>("get_pending_request");
          if (!payload) break;
          applyPayload(payload);
          await invoke("clear_pending_request");
        }
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
