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
    const envelope = await exportFormat.createSignedExportEnvelope("wallet", { glyph: 1, name: "Main" });
    const parsed = await exportFormat.parseSignedExportEnvelope<{ glyph: number; name: string }>(
      JSON.stringify(envelope),
      "wallet",
    );

    expect(parsed.verified).toBe(true);
    expect(parsed.legacy).toBe(false);
    expect(parsed.version).toBe(2);
    expect(parsed.exportType).toBe("wallet");
    expect(parsed.payload).toEqual({ glyph: 1, name: "Main" });
  });

  test("marks a payload changed after signing as unverified", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("wallet", { name: "Main" });
    const tampered = { ...envelope, payload: { name: "Changed" } };
    const parsed = await exportFormat.parseSignedExportEnvelope<{ name: string }>(
      JSON.stringify(tampered),
      "wallet",
    );

    expect(parsed.verified).toBe(false);
    expect(parsed.payload).toEqual({ name: "Changed" });
  });

  test("rejects a signature that does not match the payload hash", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("wallet", { name: "Main" });
    const forged = {
      ...envelope,
      meta: { ...envelope.meta, signature: btoa("x".repeat(32)) },
    };

    await expect(
      exportFormat.parseSignedExportEnvelope(JSON.stringify(forged), "wallet"),
    ).rejects.toThrow(/integrity/);
  });

  test("does not verify an envelope created for another export type", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("wallet", { name: "Main" });
    const parsed = await exportFormat.parseSignedExportEnvelope(JSON.stringify(envelope), "contacts");

    expect(parsed.verified).toBe(false);
    expect(parsed.exportType).toBe("wallet");
  });

  test("returns envelopes unverified when this installation has no signing key", async () => {
    const envelope = await exportFormat.createSignedExportEnvelope("contacts", [{ name: "Alice" }]);
    persisted.usePersistedStore.setState({ exportSigningKey: null });
    const parsed = await exportFormat.parseSignedExportEnvelope(JSON.stringify(envelope), "contacts");

    expect(parsed.verified).toBe(false);
    expect(parsed.legacy).toBe(false);
  });

  test("verifies envelopes written with the legacy vault discriminator", async () => {
    const secret = btoa("0123456789abcdef0123456789abcdef");
    persisted.usePersistedStore.setState({
      exportSigningKey: { kty: "oct", k: secret, alg: "HS256", key_ops: ["sign", "verify"], ext: true },
    });
    const payload = { glyph: 1, name: "Old" };
    const payloadText = JSON.stringify(payload);
    const payloadHash = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payloadText)))));
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(secret), (ch) => ch.charCodeAt(0)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`vault:123:${payloadHash}`)))));
    const parsed = await exportFormat.parseSignedExportEnvelope<{ glyph: number; name: string }>(
      JSON.stringify({
        meta: {
          schema: "glyph_export",
          version: 2,
          exportType: "vault",
          createdAt: 123,
          signatureAlgorithm: "HMAC-SHA256",
          payloadHash,
          signature,
        },
        payload,
      }),
      "wallet",
    );

    expect(parsed.verified).toBe(true);
    expect(parsed.exportType).toBe("vault");
    expect(parsed.payload).toEqual(payload);
  });

  test("treats a bare payload as a legacy export", async () => {
    const parsed = await exportFormat.parseSignedExportEnvelope<{ name: string }>(
      JSON.stringify({ name: "Legacy" }),
      "wallet",
    );

    expect(parsed.legacy).toBe(true);
    expect(parsed.verified).toBe(false);
    expect(parsed.version).toBe(1);
    expect(parsed.exportType).toBe("legacy");
    expect(parsed.payload).toEqual({ name: "Legacy" });
  });
});
