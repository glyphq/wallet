import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const scriptsDir = import.meta.dir;

const tauriAssets = [
  [
    "https://github.com/tauri-apps/binary-releases/releases/download/apprun-old/AppRun-x86_64",
    "f30140a43a0a59e46db21bdefdf749b9e9f2c6946e92afabbacf98b8ae73fb4f",
  ],
  [
    "https://github.com/tauri-apps/binary-releases/releases/download/linuxdeploy/linuxdeploy-x86_64.AppImage",
    "e762bea85c8eb0d4b3508d46e5c1f037f717d0f9303ae3b4aafc8b04991fa1ef",
  ],
  [
    "https://github.com/linuxdeploy/linuxdeploy-plugin-appimage/releases/download/1-alpha-20250213-1/linuxdeploy-plugin-appimage-x86_64.AppImage",
    "992d502a248e14ab185448ddf6f6e7d25558cb84d4623c354c3af350c25fccb3",
  ],
] as const;

test("Tauri bundler tools use public tagged URLs and pinned checksums", async () => {
  const helper = await readFile(join(scriptsDir, "prepare-tauri-linux-tools.sh"), "utf8");

  expect(helper).not.toContain("api.github.com");
  expect(helper).not.toContain("GITHUB_TOKEN");
  expect(helper).toContain("sha256sum");
  for (const [url, checksum] of tauriAssets) {
    expect(helper).toContain(url);
    expect(helper).toContain(checksum);
  }
});

describe("release helpers avoid job-token-incompatible prefetches", () => {
  test("patch helper uses verified public downloads and no stale runtime asset", async () => {
    const helper = await readFile(join(scriptsDir, "patch-appimage.sh"), "utf8");

    expect(helper).not.toContain("api.github.com");
    expect(helper).not.toContain("440974626");
    expect(helper).not.toContain("go-appimagetool-947");
    expect(helper).toContain(
      "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage",
    );
    expect(helper).toContain("b90f4a8b18967545fda78a445b27680a1642f1ef9488ced28b65398f2be7add2");
    expect(helper).toContain(
      "https://github.com/probonopd/go-appimage/releases/download/continuous/appimagetool-951-x86_64.AppImage",
    );
    expect(helper).toContain("7c974f525d5bcde2712dd080e0b079a6c3802113a337f0ab142522dcefbf452d");
    expect(helper).toContain("sha256sum");
    expect(helper).toContain('|| die "checksum mismatch for downloaded tool: $url"');
  });

  test("production workflow delegates downloads to verified helpers", async () => {
    const workflow = await readFile(join(scriptsDir, "../.github/workflows/release.yml"), "utf8");

    expect(workflow).not.toContain("gh api");
    expect(workflow).not.toContain("releases/assets/");
    expect(workflow).not.toContain("Preload authenticated pinned AppImage tools");
    expect(workflow).toContain("scripts/prepare-tauri-linux-tools.sh");
    expect(workflow).toContain('scripts/patch-appimage.sh "$appimage"');
  });
});
