import type {
  AuditEvent,
  NotificationEvent,
  PriceSnapshot,
  RequestHistoryItem,
  RuntimeIssue,
} from "./persisted-types";
import {
  MAX_AUDIT_EVENTS,
  MAX_NOTIFICATION_EVENTS,
  MAX_PRICE_SNAPSHOTS,
  MAX_REQUEST_HISTORY,
  MAX_RUNTIME_ISSUES,
  MAX_TX_MEMOS,
} from "./persisted-limits";

export function clampTxMemos(
  txMemos: Record<string, string>
): Record<string, string> {
  const entries = Object.entries(txMemos);
  if (entries.length <= MAX_TX_MEMOS) return txMemos;
  return Object.fromEntries(entries.slice(entries.length - MAX_TX_MEMOS));
}

export function clampNotificationEvents(
  events: NotificationEvent[]
): NotificationEvent[] {
  if (events.length <= MAX_NOTIFICATION_EVENTS) return events;
  return events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_NOTIFICATION_EVENTS);
}

export function clampAuditEvents(events: AuditEvent[]): AuditEvent[] {
  if (events.length <= MAX_AUDIT_EVENTS) return events;
  return events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_AUDIT_EVENTS);
}

export function clampRequestHistory(
  events: RequestHistoryItem[]
): RequestHistoryItem[] {
  if (events.length <= MAX_REQUEST_HISTORY) return events;
  return events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_REQUEST_HISTORY);
}

export function clampPriceSnapshots(
  snapshots: PriceSnapshot[]
): PriceSnapshot[] {
  if (snapshots.length <= MAX_PRICE_SNAPSHOTS) return snapshots;
  return snapshots
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_PRICE_SNAPSHOTS);
}

export function clampRuntimeIssues(issues: RuntimeIssue[]): RuntimeIssue[] {
  if (issues.length <= MAX_RUNTIME_ISSUES) return issues;
  return issues
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_RUNTIME_ISSUES);
}
