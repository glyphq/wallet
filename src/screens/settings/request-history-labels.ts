import type { RequestHistoryItem } from "@/store/persisted";

export const REQUEST_TYPE_LABEL: Record<RequestHistoryItem["type"], string> = {
  transfer: "Send QU",
  sc_call: "Contract call",
  sign_message: "Sign message",
  verify_message: "Verify signature",
  connect: "Connect",
};

export const REQUEST_ACTION_LABEL: Record<RequestHistoryItem["action"], string> = {
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export const REQUEST_CALLBACK_LABEL: Record<RequestHistoryItem["callbackStatus"], string> = {
  none: "No callback",
  pending: "Sending callback",
  ok: "Callback delivered",
  failed: "Callback failed",
};
