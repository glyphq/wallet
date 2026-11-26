import { useEffect, useRef, useState } from "react";
import type { RequestHistoryItem } from "@/store/persisted";
import { makeRequestHistoryId } from "@/lib/request-orchestration";
import type { GlyphEnvelope } from "@/lib/request-schema";

function expiredHistoryItem(envelope: GlyphEnvelope): RequestHistoryItem {
  return {
    id: makeRequestHistoryId(),
    createdAt: Date.now(),
    type: envelope.request.type,
    dappName: envelope.request.dapp.name || "Unknown dApp",
    dappOrigin: envelope.request.dapp.origin,
    action: "expired",
    resultDetail: "Request expired before a decision was made.",
    callbackStatus: "none",
    callbackUrl: envelope.callback,
  };
}

/**
 * Auto-dismisses the request when its exp timestamp passes so approval buttons
 * don't remain active after expiry. Also drives the visible countdown.
 */
export function useRequestExpiry({
  envelope,
  suppressed,
  addRequestHistoryItem,
}: {
  envelope: GlyphEnvelope | null;
  /** True while a completion or expiry view is showing. */
  suppressed: boolean;
  addRequestHistoryItem: (item: RequestHistoryItem) => void;
}) {
  const [expiredRequest, setExpiredRequest] = useState<RequestHistoryItem | null>(null);
  const [expirySecsLeft, setExpirySecsLeft] = useState<number | null>(null);
  const expiryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!envelope?.request.exp || suppressed || expiredRequest) {
      setExpirySecsLeft(null);
      return;
    }
    const msUntilExp = envelope.request.exp * 1000 - Date.now();
    if (msUntilExp <= 0) {
      const item = expiredHistoryItem(envelope);
      addRequestHistoryItem(item);
      setExpiredRequest(item);
      return;
    }
    setExpirySecsLeft(Math.ceil(msUntilExp / 1000));
    const expire = () => {
      const item = expiredHistoryItem(envelope);
      addRequestHistoryItem(item);
      setExpiredRequest(item);
    };
    const t = setTimeout(expire, msUntilExp);
    expiryIntervalRef.current = setInterval(() => {
      const remaining = Math.ceil((envelope.request.exp! * 1000 - Date.now()) / 1000);
      setExpirySecsLeft(Math.max(0, remaining));
    }, 1000);
    return () => {
      clearTimeout(t);
      if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    };
  }, [envelope, suppressed, expiredRequest, addRequestHistoryItem]);

  return {
    expiredRequest,
    expirySecsLeft,
    clearExpiredRequest: () => setExpiredRequest(null),
  };
}
