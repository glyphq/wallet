import { describe, expect, test } from "bun:test";
import { REQUIRED_SECRETS, validateSigningConfig, validateUpdaterConfig } from "./validate-signing-config.mjs";

const updater = {
  TAURI_SIGNING_PRIVATE_KEY: "untrusted comment: minisign secret key",
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "test-only-password",
};

const native = {
  APPLE_CERTIFICATE: "base64-certificate",
  APPLE_CERTIFICATE_PASSWORD: "test-only-password",
  APPLE_SIGNING_IDENTITY: "Developer ID Application: Glyph Ecosystem",
  APPLE_ID: "release@example.invalid",
  APPLE_PASSWORD: "test-only-password",
  APPLE_TEAM_ID: "TEAMID1234",
  WINDOWS_CERTIFICATE: "c2VjcmV0",
  WINDOWS_CERTIFICATE_PASSWORD: "test-only-password",
};

describe("release signing configuration", () => {
  test("requires a minisign updater public key in Tauri configuration", () => {
    expect(() =>
      validateUpdaterConfig({ plugins: { updater: { pubkey: Buffer.from("not-a-minisign-key").toString("base64") } } }),
    ).toThrow("not a minisign public key");
    expect(() =>
      validateUpdaterConfig({
        plugins: {
          updater: {
            pubkey: Buffer.from("untrusted comment: minisign public key: TEST\npublic-key\n").toString("base64"),
          },
        },
      }),
    ).not.toThrow();
  });

  test("documents the updater and native secret sets", () => {
    expect(REQUIRED_SECRETS.updater).toEqual([
      "TAURI_SIGNING_PRIVATE_KEY",
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
    ]);
    expect(REQUIRED_SECRETS.macos).toContain("APPLE_SIGNING_IDENTITY");
    expect(REQUIRED_SECRETS.windows).toEqual(["WINDOWS_CERTIFICATE", "WINDOWS_CERTIFICATE_PASSWORD"]);
  });

  test("requires updater and all native credentials for release builds", () => {
    expect(() => validateSigningConfig({ env: { ...updater, ...native } })).not.toThrow();
    expect(() => validateSigningConfig({ env: updater })).toThrow(
      "missing required native signing secrets: APPLE_CERTIFICATE",
    );
  });

  test("requires a valid Windows certificate encoding for release builds", () => {
    expect(() =>
      validateSigningConfig({ env: { ...updater, ...native, WINDOWS_CERTIFICATE: "not-base64" } }),
    ).toThrow("WINDOWS_CERTIFICATE must be base64-encoded PKCS#12 data");
  });

  test("allows only an explicit development unsigned-native path", () => {
    const developmentEnv = { ...updater, GLYPH_DEVELOPMENT_UNSIGNED_NATIVE: "true" };
    expect(() => validateSigningConfig({ env: developmentEnv, mode: "development" })).not.toThrow();
    expect(() => validateSigningConfig({ env: updater, mode: "development" })).toThrow(
      "GLYPH_DEVELOPMENT_UNSIGNED_NATIVE=true",
    );
  });

  test("allows an unsigned native release only with an explicit opt-in", () => {
    const unsignedReleaseEnv = { ...updater, GLYPH_ALLOW_UNSIGNED_NATIVE_RELEASE: "true" };
    expect(() => validateSigningConfig({ env: unsignedReleaseEnv, mode: "unsigned-release" })).not.toThrow();
    expect(() => validateSigningConfig({ env: updater, mode: "unsigned-release" })).toThrow(
      "GLYPH_ALLOW_UNSIGNED_NATIVE_RELEASE=true",
    );
  });

  test("never makes missing updater credentials optional in development", () => {
    expect(() =>
      validateSigningConfig({
        env: { GLYPH_DEVELOPMENT_UNSIGNED_NATIVE: "true" },
        mode: "development",
        platform: "macos",
      }),
    ).toThrow("missing required updater signing secrets");
  });
});
