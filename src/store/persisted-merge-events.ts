import type {
  AuditEvent,
  NotificationEvent,
  PriceSnapshot,
  RequestHistoryItem,
  RuntimeIssue,
} from "./persisted-types";
import {
  clampAuditEvents,
  clampNotificationEvents,
  clampPriceSnapshots,
  clampRequestHistory,
  clampRuntimeIssues,
} from "./persisted-clamps";

export function mergeNotificationEvents(
  value: unknown,
  current: NotificationEvent[]
): NotificationEvent[] {
  if (!Array.isArray(value)) return current;
  return clampNotificationEvents(
    value.filter(
      (event): event is NotificationEvent =>
        !!event &&
        typeof event === "object" &&
        typeof event.id === "string" &&
        typeof event.title === "string" &&
        typeof event.body === "string" &&
        typeof event.kind === "string" &&
        typeof event.createdAt === "number"
    )
  );
}

export function mergePriceSnapshots(
  value: unknown,
  current: PriceSnapshot[]
): PriceSnapshot[] {
  if (!Array.isArray(value)) return current;
  return clampPriceSnapshots(
    value.filter(
      (snapshot): snapshot is PriceSnapshot =>
        !!snapshot &&
        typeof snapshot === "object" &&
        typeof snapshot.timestamp === "number" &&
        typeof snapshot.priceUsd === "number" &&
        Number.isFinite(snapshot.priceUsd)
    )
  );
}

export function mergeRuntimeIssues(
  value: unknown,
  current: RuntimeIssue[]
): RuntimeIssue[] {
  if (!Array.isArray(value)) return current;
  return clampRuntimeIssues(
    value.filter(
      (issue): issue is RuntimeIssue =>
        !!issue &&
        typeof issue === "object" &&
        typeof issue.id === "string" &&
        typeof issue.source === "string" &&
        typeof issue.title === "string" &&
        typeof issue.detail === "string" &&
        typeof issue.createdAt === "number"
    )
  );
}

export function mergeAuditEvents(
  value: unknown,
  current: AuditEvent[]
): AuditEvent[] {
  if (!Array.isArray(value)) return current;
  return clampAuditEvents(
    value.filter(
      (event): event is AuditEvent =>
        !!event &&
        typeof event === "object" &&
        typeof event.id === "string" &&
        typeof event.kind === "string" &&
        typeof event.title === "string" &&
        typeof event.detail === "string" &&
        typeof event.createdAt === "number"
    )
  );
}

export function mergeRequestHistory(
  value: unknown,
  current: RequestHistoryItem[]
): RequestHistoryItem[] {
  if (!Array.isArray(value)) return current;
  return clampRequestHistory(
    value.filter(
      (event): event is RequestHistoryItem =>
        !!event &&
        typeof event === "object" &&
        typeof event.id === "string" &&
        typeof event.type === "string" &&
        typeof event.dappName === "string" &&
        typeof event.dappOrigin === "string" &&
        typeof event.action === "string" &&
        typeof event.callbackStatus === "string" &&
        typeof event.createdAt === "number"
    )
  );
}
