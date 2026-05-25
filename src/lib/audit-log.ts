import { newId } from "@/lib/crypto";
import { usePersistedStore, type AuditEvent, type AuditEventKind } from "@/store/persisted";

export function recordAuditEvent(event: Omit<AuditEvent, "id" | "createdAt"> & { kind: AuditEventKind }) {
  usePersistedStore.getState().addAuditEvent({
    id: newId(),
    createdAt: Date.now(),
    ...event,
  });
}
