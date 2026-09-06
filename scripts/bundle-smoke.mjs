#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export const PRODUCT_CONTRACT = Object.freeze({
  displayName: "Glyph Wallet",
  identifier: "com.qubic.glyph",
  walletBinary: "glyph-wallet",
  brokerBinary: "glyph-link-broker",
  desktopFile: "Glyph.desktop",
});

function fail(message) {
  throw new Error(message);
}

function requireFile(path, description) {
  if (!existsSync(path) || !lstatSync(path).isFile()) fail(`${description} is missing: ${path}`);
  return path;
}

function requireExecutable(path, description) {
  requireFile(path, description);
  if ((lstatSync(path).mode & 0o111) === 0) fail(`${description} is not executable: ${path}`);
  return path;
}

function singleFile(root, predicate, description) {
  const matches = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && predicate(path, entry.name)) matches.push(path);
    }
  }
  if (matches.length !== 1) fail(`expected one ${description}, found ${matches.length}`);
  return matches[0];
}

function lines(path) {
  return readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.trim());
}

function requireLine(content, expected, description) {
  if (!content.split(/\r?\n/).includes(expected)) fail(`${description} is missing: ${expected}`);
}

export function validateChecksumManifest(root, checksumPath) {
  const resolvedRoot = resolve(root);
  const seen = new Set();
  for (const line of lines(checksumPath)) {
    const match = line.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (!match) fail(`invalid checksum line: ${line}`);
    const [, expected, name] = match;
    if (name.startsWith("/") || name.split(/[\\/]/).includes("..")) {
      fail(`checksum path escapes artifact root: ${name}`);
    }
    if (seen.has(name)) fail(`duplicate checksum entry: ${name}`);
    seen.add(name);
    const artifact = resolve(resolvedRoot, name);
    if (!artifact.startsWith(`${resolvedRoot}/`)) fail(`checksum path escapes artifact root: ${name}`);
    requireFile(artifact, "checksum artifact");
    const actual = createHash("sha256").update(readFileSync(artifact)).digest("hex");
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      fail(`checksum mismatch for ${name}: expected ${expected}, got ${actual}`);
    }
  }
  if (seen.size === 0) fail(`checksum manifest is empty: ${checksumPath}`);
  return seen.size;
}

export function validateLinuxInstalledRoot(root) {
  const wallet = join(root, "usr", "bin", PRODUCT_CONTRACT.walletBinary);
  const broker = join(root, "usr", "bin", PRODUCT_CONTRACT.brokerBinary);
  requireExecutable(wallet, "installed wallet binary");
  requireExecutable(broker, "installed link broker");

  const desktop = requireFile(
    join(root, "usr", "share", "applications", PRODUCT_CONTRACT.desktopFile),
    "installed desktop entry",
  );
  const desktopText = readFileSync(desktop, "utf8");
  for (const expected of [
    "Name=Glyph Wallet",
    "Exec=glyph-link-broker %u",
    "Icon=com.qubic.glyph",
    "MimeType=x-scheme-handler/glyph;",
    "StartupWMClass=Glyph Wallet",
  ]) requireLine(desktopText, expected, "desktop identity");

  const appstream = requireFile(
    join(root, "usr", "share", "metainfo", "com.qubic.glyph.metainfo.xml"),
    "installed AppStream metadata",
  );
  const appstreamText = readFileSync(appstream, "utf8");
  for (const expected of [
    "<id>com.qubic.glyph</id>",
    "<developer id=\"com.qubic.glyph\">",
    "<binary>glyph-wallet</binary>",
  ]) if (!appstreamText.includes(expected)) fail(`AppStream identity is missing: ${expected}`);

  const icon = singleFile(
    join(root, "usr", "share", "icons"),
    (_path, name) => name === "com.qubic.glyph.png",
    "installed Glyph notification icon",
  );
  requireFile(icon, "installed Glyph notification icon");
  return { wallet, broker, desktop, appstream, icon };
}

function plistValue(text, key) {
  const pattern = new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`);
  return text.match(pattern)?.[1] ?? null;
}

export function validateMacInstalledRoot(root) {
  const plist = singleFile(
    root,
    (_path, name) => name === "Info.plist" && _path.includes(".app/Contents/"),
    "macOS application Info.plist",
  );
  const text = readFileSync(plist, "utf8");
  if (plistValue(text, "CFBundleDisplayName") !== PRODUCT_CONTRACT.displayName) {
    fail("macOS bundle display name is not Glyph Wallet");
  }
  if (plistValue(text, "CFBundleIdentifier") !== PRODUCT_CONTRACT.identifier) {
    fail("macOS bundle identifier is not com.qubic.glyph");
  }
  if (plistValue(text, "CFBundleExecutable") !== PRODUCT_CONTRACT.walletBinary) {
    fail("macOS bundle executable is not glyph-wallet");
  }
  return { plist };
}

export function validateWindowsInstalledRoot(root) {
  const executable = singleFile(
    root,
    (_path, name) => /^(glyph-wallet|glyph wallet|glyph)[.]exe$/i.test(name),
    "Windows Glyph Wallet executable",
  );
  const header = readFileSync(executable).subarray(0, 2).toString("ascii");
  if (header !== "MZ") fail(`Windows wallet executable is not a PE file: ${executable}`);
  return { executable };
}

export function validateBundle({ root, platform, checksumPath }) {
  if (!existsSync(root) || !lstatSync(root).isDirectory()) fail(`artifact root is missing: ${root}`);
  const result = platform === "linux"
    ? validateLinuxInstalledRoot(root)
    : platform === "macos"
      ? validateMacInstalledRoot(root)
      : platform === "windows"
        ? validateWindowsInstalledRoot(root)
        : fail(`unsupported platform: ${platform}`);
  const checksumEntries = checksumPath ? validateChecksumManifest(root, checksumPath) : 0;
  return { ...result, checksumEntries };
}

function usage() {
  console.error("usage: node scripts/bundle-smoke.mjs --root <extracted-root> --platform <linux|macos|windows> [--checksums <file>]");
}

function cli(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag);
    return index < 0 ? undefined : argv[index + 1];
  };
  const root = value("--root");
  const platform = value("--platform");
  const checksumPath = value("--checksums");
  if (!root || !platform || (checksumPath && !existsSync(checksumPath))) {
    usage();
    process.exitCode = 2;
    return;
  }
  try {
    const result = validateBundle({ root: resolve(root), platform, checksumPath: checksumPath && resolve(checksumPath) });
    console.log(`[bundle-smoke] ${platform} identity and integrity checks passed (${result.checksumEntries} checksum entries)`);
  } catch (error) {
    console.error(`[bundle-smoke] ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) cli(process.argv.slice(2));
