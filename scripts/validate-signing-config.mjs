#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const UPDATER_SECRETS = ["TAURI_SIGNING_PRIVATE_KEY", "TAURI_SIGNING_PRIVATE_KEY_PASSWORD"];
const MACOS_SECRETS = [
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_SIGNING_IDENTITY",
  "APPLE_ID",
  "APPLE_PASSWORD",
  "APPLE_TEAM_ID",
];
const WINDOWS_SECRETS = ["WINDOWS_CERTIFICATE", "WINDOWS_CERTIFICATE_PASSWORD"];

export const REQUIRED_SECRETS = Object.freeze({
  updater: Object.freeze([...UPDATER_SECRETS]),
  macos: Object.freeze([...MACOS_SECRETS]),
  windows: Object.freeze([...WINDOWS_SECRETS]),
});

function missingSecrets(env, names) {
  return names.filter((name) => typeof env[name] !== "string" || env[name].trim() === "");
}

function validateWindowsCertificate(env) {
  const certificate = env.WINDOWS_CERTIFICATE?.replace(/\s+/g, "") ?? "";
  if (certificate === "") return;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(certificate) || certificate.length % 4 !== 0) {
    throw new Error("WINDOWS_CERTIFICATE must be base64-encoded PKCS#12 data");
  }
  try {
    if (Buffer.from(certificate, "base64").length === 0) throw new Error("empty certificate");
  } catch {
    throw new Error("WINDOWS_CERTIFICATE must be base64-encoded PKCS#12 data");
  }
}

export function validateUpdaterConfig(config) {
  const publicKey = config?.plugins?.updater?.pubkey;
  if (typeof publicKey !== "string" || publicKey.trim() === "") {
    throw new Error("Tauri updater public key is not configured");
  }
  let decoded;
  try {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey) || publicKey.length % 4 !== 0) {
      throw new Error("invalid base64");
    }
    decoded = Buffer.from(publicKey, "base64").toString("utf8");
  } catch {
    throw new Error("Tauri updater public key is not valid base64");
  }
  if (!decoded.startsWith("untrusted comment: minisign public key:") || !decoded.includes("\n")) {
    throw new Error("Tauri updater public key is not a minisign public key");
  }
}

/**
 * Validate the secret names needed by a release build without printing secret
 * values. Development artifacts may explicitly opt out of native platform
 * signing, but updater signing remains mandatory in every build path.
 */
export function validateSigningConfig({ env = process.env, mode = "release", platform = "all" } = {}) {
  if (!['release', 'development'].includes(mode)) {
    throw new Error(`unsupported signing mode: ${mode}`);
  }
  if (!['all', 'macos', 'windows', 'linux'].includes(platform)) {
    throw new Error(`unsupported signing platform: ${platform}`);
  }

  const missing = missingSecrets(env, UPDATER_SECRETS);
  if (missing.length > 0) {
    throw new Error(`missing required updater signing secrets: ${missing.join(", ")}`);
  }

  if (platform === "linux") return { mode, platform, missing: [] };

  const requiredNative = [];
  if (platform === "all" || platform === "macos") requiredNative.push(...MACOS_SECRETS);
  if (platform === "all" || platform === "windows") requiredNative.push(...WINDOWS_SECRETS);

  if (mode === "release") {
    const missingNative = missingSecrets(env, requiredNative);
    if (missingNative.length > 0) {
      throw new Error(`missing required native signing secrets: ${missingNative.join(", ")}`);
    }
    validateWindowsCertificate(env);
  } else {
    if (env.GLYPH_DEVELOPMENT_UNSIGNED_NATIVE !== "true") {
      throw new Error(
        "development signing mode requires GLYPH_DEVELOPMENT_UNSIGNED_NATIVE=true when native signing is optional",
      );
    }
    const completeNative = missingSecrets(env, requiredNative).length === 0;
    if (completeNative) validateWindowsCertificate(env);
  }

  return { mode, platform, missing: [] };
}

function parseArgs(args) {
  const options = { mode: "release", platform: "all", configPath: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--mode") options.mode = args[++index];
    else if (argument === "--platform") options.platform = args[++index];
    else if (argument === "--config") options.configPath = args[++index];
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.configPath) validateUpdaterConfig(JSON.parse(readFileSync(options.configPath, "utf8")));
    validateSigningConfig(options);
    console.log(`validated ${options.mode} signing configuration for ${options.platform}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
