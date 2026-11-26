import type { PersistedState, ScheduledTransfer } from "./persisted-types";
import { clampTxMemos } from "./persisted-clamps";
import { MAX_PENDING_TXS, MAX_SCHEDULED_TRANSFERS } from "./persisted-limits";

type Contacts = PersistedState["contacts"];
type PendingTxs = PersistedState["pendingTxs"];
type TxMemos = PersistedState["txMemos"];
type TxTags = PersistedState["txTags"];

export function mergeContacts(value: unknown, current: Contacts): Contacts {
  if (!Array.isArray(value)) return current;
  return value
    .filter(
      (contact): contact is Contacts[number] =>
        !!contact &&
        typeof contact === "object" &&
        typeof contact.id === "string" &&
        typeof contact.name === "string" &&
        typeof contact.identity === "string" &&
        typeof contact.addedAt === "number" &&
        typeof contact.lastUsedAt === "number"
    )
    .map((contact) => {
      const { note: _note, ...rest } = contact as typeof contact & { note?: unknown };
      return rest;
    });
}

export function mergePendingTxs(value: unknown, current: PendingTxs): PendingTxs {
  if (!Array.isArray(value)) return current;
  return value
    .filter(
      (tx): tx is PendingTxs[number] =>
        !!tx &&
        typeof tx === "object" &&
        typeof tx.hash === "string" &&
        typeof tx.source === "string" &&
        typeof tx.destination === "string" &&
        typeof tx.amount === "string" &&
        typeof tx.targetTick === "number" &&
        typeof tx.broadcastAt === "number"
    )
    .slice(0, MAX_PENDING_TXS);
}

export function mergeTxMemos(value: unknown, current: TxMemos): TxMemos {
  return value && typeof value === "object" && !Array.isArray(value)
    ? clampTxMemos(value as TxMemos)
    : current;
}

export function mergeTxTags(value: unknown, current: TxTags): TxTags {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as TxTags)
    : current;
}

export function mergeScheduledTransfers(
  value: unknown,
  current: ScheduledTransfer[]
): ScheduledTransfer[] {
  if (!Array.isArray(value)) return current;
  return (value as ScheduledTransfer[])
    .filter(
      (t) =>
        !!t &&
        typeof t === "object" &&
        typeof t.id === "string" &&
        typeof t.label === "string" &&
        typeof t.sourceIdentity === "string" &&
        typeof t.destination === "string" &&
        typeof t.amount === "string" &&
        typeof t.intervalDays === "number" &&
        typeof t.nextRunAt === "number" &&
        typeof t.createdAt === "number" &&
        typeof t.enabled === "boolean"
    )
    .slice(0, MAX_SCHEDULED_TRANSFERS);
}
