import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  validateBundle,
  validateChecksumManifest,
  validateLinuxInstalledRoot,
} from "./bundle-smoke.mjs";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function linuxFixture() {
  const root = await mkdtemp(join(tmpdir(), "glyph-bundle-smoke-"));
  roots.push(root);
  await mkdir(join(root, "usr/bin"), { recursive: true });
  await mkdir(join(root, "usr/share/applications"), { recursive: true });
  await mkdir(join(root, "usr/share/metainfo"), { recursive: true });
  await mkdir(join(root, "usr/share/icons/hicolor/128x128/apps"), { recursive: true });
  await writeFile(join(root, "usr/bin/glyph-wallet"), "wallet");
  await writeFile(join(root, "usr/bin/glyph-link-broker"), "broker");
  await chmod(join(root, "usr/bin/glyph-wallet"), 0o755);
  await chmod(join(root, "usr/bin/glyph-link-broker"), 0o755);
  await writeFile(join(root, "usr/share/applications/Glyph.desktop"), `[Desktop Entry]\nName=Glyph Wallet\nExec=glyph-link-broker %u\nIcon=com.qubic.glyph\nMimeType=x-scheme-handler/glyph;\nStartupWMClass=Glyph Wallet\n`);
  await writeFile(join(root, "usr/share/metainfo/com.qubic.glyph.metainfo.xml"), `<component type="desktop-application"><id>com.qubic.glyph</id><developer id="com.qubic.glyph"><name>Glyph Ecosystem</name></developer><provides><binary>glyph-wallet</binary></provides></component>`);
  await writeFile(join(root, "usr/share/icons/hicolor/128x128/apps/com.qubic.glyph.png"), "icon");
  return root;
}

describe("installed bundle identity contract", () => {
  test("accepts the Linux installed product identity and broker route", async () => {
    const root = await linuxFixture();
    expect(validateLinuxInstalledRoot(root).wallet).toEndWith("/usr/bin/glyph-wallet");
  });

  test("rejects a lookalike desktop entry that bypasses the link broker", async () => {
    const root = await linuxFixture();
    const desktop = join(root, "usr/share/applications/Glyph.desktop");
    await writeFile(desktop, "[Desktop Entry]\nName=Glyph Wallet\nExec=glyph-wallet %u\nIcon=com.qubic.glyph\nMimeType=x-scheme-handler/glyph;\nStartupWMClass=Glyph Wallet\n");
    expect(() => validateLinuxInstalledRoot(root)).toThrow("Exec=glyph-link-broker %u");
  });

  test("rejects a non-executable installed wallet", async () => {
    const root = await linuxFixture();
    await chmod(join(root, "usr/bin/glyph-wallet"), 0o644);
    expect(() => validateLinuxInstalledRoot(root)).toThrow("not executable");
  });
});

describe("release checksum contract", () => {
  test("accepts valid entries and detects tampering", async () => {
    const root = await mkdtemp(join(tmpdir(), "glyph-checksum-smoke-"));
    roots.push(root);
    const artifact = join(root, "Glyph Wallet.AppImage");
    await writeFile(artifact, "immutable release bytes");
    const digest = createHash("sha256").update("immutable release bytes").digest("hex");
    const manifest = join(root, "SHA256SUMS-linux.txt");
    await writeFile(manifest, `${digest}  *Glyph Wallet.AppImage\n`);
    expect(validateChecksumManifest(root, manifest)).toBe(1);
    await writeFile(artifact, "mutated release bytes");
    expect(() => validateChecksumManifest(root, manifest)).toThrow("checksum mismatch");
  });

  test("rejects duplicate and traversal entries", async () => {
    const root = await mkdtemp(join(tmpdir(), "glyph-checksum-adversarial-"));
    roots.push(root);
    const digest = createHash("sha256").update("x").digest("hex");
    const duplicate = join(root, "duplicate.txt");
    await writeFile(duplicate, "x");
    const duplicateManifest = join(root, "duplicate.sha256");
    await writeFile(duplicateManifest, `${digest}  duplicate.txt\n${digest}  duplicate.txt\n`);
    expect(() => validateChecksumManifest(root, duplicateManifest)).toThrow("duplicate checksum entry");
    const traversalManifest = join(root, "traversal.sha256");
    await writeFile(traversalManifest, `${digest}  ../outside\n`);
    expect(() => validateChecksumManifest(root, traversalManifest)).toThrow("escapes artifact root");
  });
});

describe("cross-platform bundle identity checks", () => {
  test("checks macOS Info.plist identity", async () => {
    const root = await mkdtemp(join(tmpdir(), "glyph-macos-smoke-"));
    roots.push(root);
    const contents = join(root, "Glyph Wallet.app/Contents");
    await mkdir(contents, { recursive: true });
    await writeFile(join(contents, "Info.plist"), `<?xml version="1.0"?><plist><dict><key>CFBundleDisplayName</key><string>Glyph Wallet</string><key>CFBundleIdentifier</key><string>com.qubic.glyph</string><key>CFBundleExecutable</key><string>glyph-wallet</string></dict></plist>`);
    expect(validateBundle({ root, platform: "macos" }).plist).toEndWith("Info.plist");
  });

  test("checks the Windows PE magic before trusting an installer payload", async () => {
    const root = await mkdtemp(join(tmpdir(), "glyph-windows-smoke-"));
    roots.push(root);
    await writeFile(join(root, "Glyph Wallet.exe"), Buffer.from("MZtest", "ascii"));
    expect(validateBundle({ root, platform: "windows" }).executable).toEndWith("Glyph Wallet.exe");
    await writeFile(join(root, "Glyph Wallet.exe"), Buffer.from("NO", "ascii"));
    expect(() => validateBundle({ root, platform: "windows" })).toThrow("not a PE file");
  });
});
