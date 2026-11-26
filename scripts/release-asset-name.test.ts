import { describe, expect, test } from "bun:test";
import { normalizeAssetName } from "./release-asset-name.mjs";

describe("release asset names", () => {
  test("normalizes spaces the way GitHub release uploads do", () => {
    expect(normalizeAssetName("Glyph Wallet_1.0.0_x64-setup.exe"))
      .toBe("Glyph.Wallet_1.0.0_x64-setup.exe");
    expect(normalizeAssetName("Glyph_1.0.0_universal.app.tar.gz"))
      .toBe("Glyph_1.0.0_universal.app.tar.gz");
  });
});
