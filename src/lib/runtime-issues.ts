import { usePersistedStore, type RuntimeIssue } from "@/store/persisted";

function sanitize(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

export function recordRuntimeIssue(input: Omit<RuntimeIssue, "id" | "createdAt"> & { createdAt?: number }) {
  const issue: RuntimeIssue = {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source: input.source,
    title: sanitize(input.title),
    detail: sanitize(input.detail),
    createdAt: input.createdAt ?? Date.now(),
  };
  usePersistedStore.getState().addRuntimeIssue(issue);
}
