/** A recurring transfer that runs on a fixed day interval. */
export interface ScheduledTransfer {
  id: string;
  label: string;
  sourceIdentity: string;
  destination: string;
  amount: string;
  intervalDays: number;
  nextRunAt: number;
  createdAt: number;
  enabled: boolean;
}

/** A broadcast transaction awaiting confirmation or expiry tracking. */
export interface PendingTx {
  hash: string;
  source: string;
  destination: string;
  amount: string;
  targetTick: number;
  broadcastAt: number;
  /** Present for SC calls — used as the notification label instead of the raw amount. */
  contractName?: string;
}

export type NotificationEventKind =
  | "received"
  | "sent"
  | "confirmed"
  | "failed"
  | "expired"
  | "deep_link"
  | "price_alert"
  | "system";

export interface NotificationEvent {
  id: string;
  kind: NotificationEventKind;
  title: string;
  body: string;
  createdAt: number;
  readAt: number | null;
  identity?: string;
  txHash?: string;
  dedupeKey?: string;
}

export interface PriceSnapshot {
  timestamp: number;
  priceUsd: number;
}

export interface RuntimeIssue {
  id: string;
  source: "native" | "renderer" | "updater" | "storage";
  title: string;
  detail: string;
  createdAt: number;
}

export type AuditEventKind =
  | "unlock_succeeded"
  | "unlock_failed"
  | "seed_revealed"
  | "wallet_exported"
  | "contacts_exported"
  | "request_received"
  | "request_approved"
  | "request_rejected"
  | "request_callback_failed";

export interface AuditEvent {
  id: string;
  kind: AuditEventKind;
  createdAt: number;
  status: "success" | "failure" | "info";
  title: string;
  detail: string;
  walletId?: string;
  accountIndex?: number;
}

export type RequestHistoryAction = "approved" | "rejected" | "expired";
export type RequestHistoryCallbackStatus = "none" | "pending" | "ok" | "failed";

export interface RequestHistoryItem {
  id: string;
  createdAt: number;
  type: "transfer" | "sc_call" | "sign_message" | "verify_message" | "connect";
  dappName: string;
  dappOrigin: string;
  action: RequestHistoryAction;
  accountIdentity?: string;
  accountName?: string;
  resultKind?: "tx" | "message" | "verify" | "connect";
  resultDetail?: string;
  callbackStatus: RequestHistoryCallbackStatus;
  callbackUrl?: string | null;
  callbackBody?: string;
  callbackUpdatedAt?: number | null;
}
