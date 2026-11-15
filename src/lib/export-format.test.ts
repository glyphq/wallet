import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type * as ExportFormat from "@/lib/export-format";

type ExportFormatModule = typeof ExportFormat;
type PersistedModule = typeof import("@/store/persisted");

let exportFormat: ExportFormatModule;
let persisted: PersistedModule;

beforeAll(async () => {
  // The persisted store logs and dispatches an event when Tauri storage is
  // unavailable in the test runtime. Provide the minimal browser surface it
  // touches before either module is evaluated.
  const invoke = async (command: string, args?: { value?: string }) => {
    if (command === "encrypt_store_value" || command === "decrypt_store_value") {
      return args?.value ?? null;
    }
    if (command === "plugin:store|get") return [null, false];
    return null;
  };
  (globalThis as { window?: unknown }).window ??= {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    __TAURI_INTERNALS__: { invoke },
  };
  exportFormat = await import("@/lib/export-format");
  persisted = await import("@/store/persisted");
});

beforeEach(() => {
  persisted.usePersistedStore.setState({ exportSigningKey: null });
});

afterAll(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("signed export envelopes", () => {
  test("round-trips a payload with a verifiable signature", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("vault", { glyph: 1, name: "Main" });
    const parsed = await exportFormat.parseSignedExportEnvelope<{ glyph: number; name: string }>(
      JSON.stringify(envelope),
      "vault",
    );

    expect(parsed.verified).toBe(true);
    expect(parsed.legacy).toBe(false);
    expect(parsed.version).toBe(2);
    expect(parsed.exportType).toBe("vault");
    expect(parsed.payload).toEqual({ glyph: 1, name: "Main" });
  });

  test("marks a payload changed after signing as unverified", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("vault", { name: "Main" });
    const tampered = { ...envelope, payload: { name: "Changed" } };
    const parsed = await exportFormat.parseSignedExportEnvelope<{ name: string }>(
      JSON.stringify(tampered),
      "vault",
    );

    expect(parsed.verified).toBe(false);
    expect(parsed.payload).toEqual({ name: "Changed" });
  });

  test("rejects a signature that does not match the payload hash", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("vault", { name: "Main" });
    const forged = {
      ...envelope,
      meta: { ...envelope.meta, signature: btoa("x".repeat(32)) },
    };

    await expect(
      exportFormat.parseSignedExportEnvelope(JSON.stringify(forged), "vault"),
    ).rejects.toThrow(/integrity/);
  });

  test("does not verify an envelope created for another export type", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("vault", { name: "Main" });
    const parsed = await exportFormat.parseSignedExportEnvelope(JSON.stringify(envelope), "contacts");

    expect(parsed.verified).toBe(false);
    expect(parsed.exportType).toBe("vault");
  });

  test("returns envelopes unverified when this installation has no signing key", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("contacts", [{ name: "Alice" }]);
    persisted.usePersistedStore.setState({ exportSigningKey: null });
    const parsed = await exportFormat.parseSignedExportEnvelope(JSON.stringify(envelope), "contacts");

    expect(parsed.verified).toBe(false);
    expect(parsed.legacy).toBe(false);
  });

  test("treats a bare payload as a legacy export", async () => {
    const parsed = await exportFormat.parseSignedExportEnvelope<{ name: string }>(
      JSON.stringify({ name: "Legacy" }),
      "vault",
    );

    expect(parsed.legacy).toBe(true);
    expect(parsed.verified).toBe(false);
    expect(parsed.version).toBe(1);
    expect(parsed.exportType).toBe("legacy");
    expect(parsed.payload).toEqual({ name: "Legacy" });
  });
});
