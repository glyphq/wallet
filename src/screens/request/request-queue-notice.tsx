import { StatusLine } from "./sheet-layout";

/** Warning shown above the active request when more requests are waiting in the queue. */
export function RequestQueueNotice({ pendingRequestCount }: { pendingRequestCount: number }) {
  if (pendingRequestCount <= 1) return null;
  return (
    <StatusLine tone="warning">
      {pendingRequestCount - 1} more request{pendingRequestCount > 2 ? "s" : ""} queued
    </StatusLine>
  );
}
